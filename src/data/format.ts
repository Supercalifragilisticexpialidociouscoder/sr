/** Presentation helpers. Indian conventions throughout: ₹, lakh/crore grouping. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** `₹1,20,500` — whole rupees, Indian digit grouping. */
export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  return `${sign}₹${inr.format(Math.abs(Math.round(value)))}`
}

/**
 * A unit rate. Paise matter at ₹86.40 per km and are noise at ₹15,180 per
 * trip, so the precision follows the magnitude.
 */
export function moneyPrecise(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  const n = Math.abs(value)
  return `${sign}₹${n >= 1000 ? inr.format(Math.round(n)) : inr2.format(n)}`
}

/** Compact axis/badge form: `₹4.2L`, `₹12.5k`, `₹1.1Cr`. */
export function moneyCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  const n = Math.abs(value)
  if (n >= 1e7) return `${sign}₹${trim(n / 1e7)}Cr`
  if (n >= 1e5) return `${sign}₹${trim(n / 1e5)}L`
  if (n >= 1e3) return `${sign}₹${trim(n / 1e3)}k`
  return `${sign}₹${Math.round(n)}`
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export function number(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Distance. A tenth matters on one leg; on a yearly total it is noise. */
export function km(value: number | null | undefined, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const places = decimals ?? (Number.isInteger(value) || Math.abs(value) >= 1000 ? 0 : 1)
  return `${number(value, places)} km`
}

/** Tonnage. A half-tonne matters on one load; on a yearly total it is noise. */
export function tonnes(value: number | null | undefined, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const places = decimals ?? (Number.isInteger(value) ? 0 : Math.abs(value) >= 100 ? 0 : 2)
  return `${number(value, places)} t`
}

export function litres(value: number | null | undefined, decimals = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : `${number(value, decimals)} L`
}

export function percent(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  return `${sign}${number(Math.abs(value) * 100, decimals)}%`
}

/**
 * How the bottom line relates to revenue.
 *
 * A margin below −100% is arithmetically fine and completely unreadable: at
 * one logged trip against a full tank of diesel, "−192.7%" tells an owner
 * nothing. Past that point the same fact is stated the way it would be said
 * out loud — costs are so many times revenue.
 */
export function marginNote(profit: number, revenue: number, expenses: number): string | null {
  if (revenue <= 0) return expenses > 0 ? 'no revenue recorded against these costs' : null
  const margin = profit / revenue
  if (margin >= -1) return `${percent(margin, 1)} of revenue`
  return `costs are ${number(expenses / revenue, 1)}× revenue`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `14 Aug 2026` */
export function date(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** `14 Aug` — for dense table columns where the year is implied. */
export function dateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return '—'
  return `${d} ${MONTHS[m - 1]}`
}

/** Human relative day count, used for licence/service alerts. */
export function relativeDays(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 0) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from `a` to `b`; negative when `b` is in the past. */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000)
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/**
 * Groups an Indian registration the way it is printed on the plate:
 * `TG08V7396` reads as `TG 08 V 7396` — state, RTO district, series, number.
 * Anything that does not match that shape is left as it was typed.
 */
export function plate(reg: string): string {
  const raw = reg.replace(/[\s-]+/g, '').toUpperCase()
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/.exec(raw)
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  // Bharat-series and defence plates keep their own shape.
  return reg.replace(/\s+/g, ' ').trim().toUpperCase()
}

/** `6281747305` reads as `62817 47305`; anything already formatted is kept. */
export function phone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return value
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
