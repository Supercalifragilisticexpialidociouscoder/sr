/** Presentation helpers. Indian conventions throughout: ₹, lakh/crore grouping. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** `₹1,20,500` — whole rupees, Indian digit grouping. */
export function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  return `${sign}₹${inr.format(Math.abs(Math.round(value)))}`
}

/** `₹86.40` — for unit rates where paise matter (cost/km, price/litre). */
export function moneyPrecise(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value < 0 ? '−' : ''
  return `${sign}₹${inr2.format(Math.abs(value))}`
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

export function km(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : `${number(value)} km`
}

/** Tonnage. A half-tonne matters on one load; on a yearly total it is noise. */
export function tonnes(value: number | null | undefined, decimals?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const places = decimals ?? (Math.abs(value) >= 100 ? 0 : 1)
  return `${number(value, places)} t`
}

export function litres(value: number | null | undefined, decimals = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : `${number(value, decimals)} L`
}

export function percent(value: number | null | undefined, decimals = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : `${number(value * 100, decimals)}%`
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

/** Registration plates read best with the state code split off. */
export function plate(reg: string): string {
  return reg.replace(/\s+/g, ' ').trim().toUpperCase()
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
