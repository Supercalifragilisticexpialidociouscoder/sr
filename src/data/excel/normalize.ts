/**
 * Turning spreadsheet cells into records.
 *
 * Everything here is defensive on purpose. A real company workbook is typed by
 * people across months: dates arrive as text, as Excel serial numbers and as
 * real dates in the same column; amounts carry ₹ signs, commas and trailing
 * spaces; the same truck is written three different ways. None of that is an
 * error to reject — it is the normal shape of the input.
 */

import { toISO } from '../format'
import { CATEGORY_ORDER, type ExpenseCategory } from '../types'

export type Cell = string | number | boolean | Date | null | undefined

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export function text(value: Cell): string {
  if (value == null) return ''
  if (value instanceof Date) return toISO(value)
  return String(value).trim()
}

/** Comparison key for headers and labels: case, spacing and punctuation all go. */
export function key(value: Cell): string {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Reads a number out of whatever the cell holds.
 *
 * Handles `₹1,20,500.50`, `1 234`, `(450)` for negatives, `12.5 L`, and the
 * empty string. Returns `null` rather than `0` when there is no number to
 * find, so a blank cell is never mistaken for a real zero.
 */
export function number(value: Cell): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return null
  if (value instanceof Date) return null

  let raw = String(value).trim()
  if (!raw) return null

  // Accounting style: (1,200) means negative.
  let sign = 1
  if (/^\(.*\)$/.test(raw)) { sign = -1; raw = raw.slice(1, -1) }
  if (/^-/.test(raw)) { sign = -1; raw = raw.slice(1) }

  // Strip currency marks, thousands separators, spaces and trailing units.
  const cleaned = raw
    .replace(/[₹$€£]/g, '')
    .replace(/(?:rs|inr)\.?/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/(?:kms?|ltrs?|lts?|litres?|liters?|tons?|tonnes?|mt|kg)$/i, '')

  const match = /^\d*\.?\d+/.exec(cleaned)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? sign * n : null
}

/** A quantity that must be positive to mean anything (litres, tonnage, rate). */
export function positive(value: Cell): number | null {
  const n = number(value)
  return n != null && n > 0 ? n : null
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

/**
 * Reads a date, in the order of likelihood for an Indian transport workbook.
 *
 * Ambiguous numeric dates are read **day-first** (`04/09/2026` is 4 September),
 * because that is the convention everywhere this data is typed. A value that
 * cannot be a real date returns `null` for the caller to report, rather than
 * silently becoming today.
 */
export function date(value: Cell): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toISO(value)
  }

  // Excel keeps dates as days since 1899-12-30.
  if (typeof value === 'number') {
    if (value < 1 || value > 2958465) return null
    const ms = EXCEL_EPOCH + Math.round(value) * 86_400_000
    return toISO(new Date(ms))
  }

  const raw = String(value).trim()
  if (!raw) return null

  // Already ISO.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
  if (iso) return build(+iso[1], +iso[2], +iso[3])

  // d/m/y or d-m-y or d.m.y, with 2- or 4-digit years.
  const dmy = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})$/.exec(raw)
  if (dmy) {
    let [, d, m, y] = dmy.map(Number) as [number, number, number, number]
    // A first part above 12 can only be the day; otherwise assume day-first.
    if (d <= 12 && m > 12) [d, m] = [m, d]
    if (y < 100) y += y < 70 ? 2000 : 1900
    return build(y, m, d)
  }

  // "4 Sep 2026", "04-September-2026", "Sep 4, 2026"
  const parsed = Date.parse(raw.replace(/(\d)(st|nd|rd|th)/gi, '$1'))
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed)
    if (d.getFullYear() > 1990 && d.getFullYear() < 2100) return toISO(d)
  }
  return null
}

function build(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const made = new Date(y, m - 1, d)
  if (made.getMonth() !== m - 1 || made.getDate() !== d) return null  // 31 Feb
  return toISO(made)
}

/* ------------------------------------------------------------------ */
/* Vehicle registrations                                               */
/* ------------------------------------------------------------------ */

/**
 * The identity key for a vehicle.
 *
 * `TS09AB1234`, `TS 09 AB 1234` and `TS-09-AB-1234` are one truck. Collapsing
 * them to a single key is what stops a fleet of three appearing as a fleet of
 * nine after an import. The original spelling is kept separately for display.
 */
export function registrationKey(value: Cell): string {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** True when a string plausibly *is* a registration rather than a name. */
export function looksLikeRegistration(value: Cell): boolean {
  const k = registrationKey(value)
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(k)
}

/* ------------------------------------------------------------------ */
/* Expense categories                                                  */
/* ------------------------------------------------------------------ */

/**
 * Maps whatever the sheet calls a cost onto the product's category set.
 *
 * Longest patterns are tested first so "diesel expense" does not match on
 * "expense", and "tyre puncture" lands on puncture rather than tyres.
 */
const CATEGORY_PATTERNS: [ExpenseCategory, string[]][] = [
  ['adblue', ['adblue', 'ad blue', 'adbleu', 'urea', 'def']],
  ['fastag', ['fastag', 'fast tag', 'fasttag', 'tag recharge', 'toll tag']],
  ['diesel', ['diesel', 'hsd', 'high speed diesel', 'fuel', 'petrol', 'dsl']],
  ['puncture', ['puncture', 'puncher', 'punchar', 'flat tyre', 'flat tire']],
  ['tyres', ['tyre', 'tire', 'tayar', 'retread']],
  ['toll', ['toll', 'toll tax', 'toll plaza', 'octroi', 'border tax']],
  ['driver', ['driver', 'batta', 'bata', 'salary', 'wages', 'khoraki', 'advance']],
  ['service', ['service', 'servicing', 'maintenance', 'oil change', 'engine oil', 'greasing', 'washing']],
  ['repairs', ['repair', 'breakdown', 'welding', 'bodywork', 'body work', 'denting', 'painting']],
  ['parts', ['parts', 'spare', 'spares', 'accessories', 'battery', 'clutch', 'brake']],
  ['insurance', ['insurance', 'policy', 'premium']],
  ['documents', ['permit', 'document', 'rto', 'fitness', 'road tax', 'tax', 'pollution', 'puc', 'challan', 'fine']],
  ['other', ['other', 'misc', 'miscellaneous', 'sundry', 'general']],
]

export function category(value: Cell): ExpenseCategory | null {
  const raw = text(value).toLowerCase()
  if (!raw) return null

  // An exact category name always wins.
  const k = key(raw)
  const exact = CATEGORY_ORDER.find((c) => c === k)
  if (exact) return exact

  const hits: { category: ExpenseCategory; length: number }[] = []
  for (const [cat, patterns] of CATEGORY_PATTERNS) {
    for (const pattern of patterns) {
      if (raw.includes(pattern)) hits.push({ category: cat, length: pattern.length })
    }
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => b.length - a.length)
  return hits[0].category
}

/* ------------------------------------------------------------------ */
/* Small enumerations                                                  */
/* ------------------------------------------------------------------ */

export function tripStatus(value: Cell): 'completed' | 'in-transit' | 'cancelled' {
  const raw = text(value).toLowerCase()
  if (!raw) return 'completed'
  if (/cancel|abort|reject/.test(raw)) return 'cancelled'
  if (/transit|running|ongoing|progress|load|dispatch/.test(raw)) return 'in-transit'
  return 'completed'
}

export function paymentMethod(value: Cell) {
  const raw = text(value).toLowerCase()
  if (/upi|phonepe|gpay|google ?pay|paytm/.test(raw)) return 'upi' as const
  if (/card|debit|credit card/.test(raw)) return 'card' as const
  if (/fastag|tag/.test(raw)) return 'fastag' as const
  if (/bank|neft|rtgs|imps|transfer|cheque|check/.test(raw)) return 'bank' as const
  if (/credit|udhar|due|pending/.test(raw)) return 'credit' as const
  return 'cash' as const
}
