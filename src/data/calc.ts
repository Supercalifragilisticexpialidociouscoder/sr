/**
 * The calculation engine.
 *
 * Every business formula in the product lives in this file. UI components read
 * these results; they never compute money themselves. That is what keeps the
 * fleet page, the vehicle financials, analytics and the CSV exports in
 * agreement — they are all reading the same functions.
 *
 * Two rules hold throughout:
 *
 *  1. **Division is always guarded.** A ratio with a zero or missing
 *     denominator returns `null`, which the UI renders as an explicit
 *     unavailable state rather than `0`, `NaN` or `∞`.
 *
 *  2. **Only completed trips are financial.** `in-transit` work has not been
 *     earned yet and `cancelled` work never will be, so neither contributes to
 *     revenue, kilometres or tonnage. In-transit trips are surfaced separately
 *     as an operational count.
 */

import {
  CATEGORY_SOURCE, MAINTENANCE_CATEGORY, CATEGORY_LABEL, DRIVER_PAYMENT_LABEL,
  MAINTENANCE_TYPE_LABEL,
  type Database, type ExpenseCategory, type LedgerLine, type Trip,
} from './types'
import { addDays, daysBetween, fromISO, toISO } from './format'

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Guarded division. Returns `null` when the result would be meaningless. */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null
  if (denominator === 0) return null
  const result = numerator / denominator
  return Number.isFinite(result) ? result : null
}

/** Freight = tonnage × price per tonne. 10 t × ₹2,000 = ₹20,000. */
export function tripFreight(tonnage: number, pricePerTon: number): number {
  return round2(nz(tonnage) * nz(pricePerTon))
}

/** Fuel cost = litres × price per litre. */
export function fuelCost(litresFilled: number, pricePerLitre: number): number {
  return round2(nz(litresFilled) * nz(pricePerLitre))
}

function nz(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + nz(b), 0)
}

/* ------------------------------------------------------------------ */
/* Date ranges                                                         */
/* ------------------------------------------------------------------ */

export interface DateRange {
  from: string
  to: string
  label: string
}

export type RangePreset = 'week' | 'month' | 'last-month' | 'year' | 'all' | 'custom'

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
]

/** Builds a concrete range from a preset, relative to `today`. */
export function presetRange(preset: RangePreset, today: string): DateRange {
  const d = fromISO(today)
  switch (preset) {
    case 'week': {
      // Weeks run Monday–Sunday, as the operations week does.
      const offset = (d.getDay() + 6) % 7
      return { from: addDays(today, -offset), to: today, label: 'This week' }
    }
    case 'month':
      return { from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: today, label: 'This month' }
    case 'last-month': {
      const start = new Date(d.getFullYear(), d.getMonth() - 1, 1)
      const end = new Date(d.getFullYear(), d.getMonth(), 0)
      return { from: toISO(start), to: toISO(end), label: 'Last month' }
    }
    case 'year':
      return { from: toISO(new Date(d.getFullYear(), 0, 1)), to: today, label: 'This year' }
    case 'all':
      return { from: '1900-01-01', to: '2999-12-31', label: 'All time' }
    case 'custom':
      return { from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: today, label: 'Custom range' }
  }
}

export function inRange(iso: string, range: DateRange): boolean {
  return iso >= range.from && iso <= range.to
}

/** Inclusive day count, used to annualise or average over a range. */
export function rangeDays(range: DateRange): number {
  return Math.max(1, daysBetween(range.from, range.to) + 1)
}

/* ------------------------------------------------------------------ */
/* The unified expense ledger                                          */
/* ------------------------------------------------------------------ */

/**
 * Normalises every expense-bearing record into one ledger.
 *
 * This is the product's answer to double counting. A diesel fill exists once,
 * as a `FuelEntry`, and reaches the ledger once, as a `diesel` line tagged
 * `source: 'fuel'`. The Add Expense form refuses to create a second one
 * because it only offers categories whose `CATEGORY_SOURCE` is `'direct'`.
 *
 * Driver payments are allocated to the driver's currently assigned vehicle.
 * A payment to an unassigned driver has `vehicleId: null` — it is a real fleet
 * cost and counts in business totals, but belongs to no single truck.
 */
export function buildLedger(db: Database): LedgerLine[] {
  const lines: LedgerLine[] = []

  for (const f of db.fuel) {
    lines.push({
      id: `fuel:${f.id}`,
      date: f.date,
      vehicleId: f.vehicleId,
      driverId: f.driverId,
      category: 'diesel',
      amount: f.totalAmount,
      description: `${f.litres} L @ ₹${f.pricePerLitre}/L · ${f.fuelStation}`,
      paymentMethod: f.paymentMethod,
      source: 'fuel',
      sourceId: f.id,
    })
  }

  for (const m of db.maintenance) {
    lines.push({
      id: `maint:${m.id}`,
      date: m.date,
      vehicleId: m.vehicleId,
      category: MAINTENANCE_CATEGORY[m.type],
      amount: m.cost,
      description: m.description || MAINTENANCE_TYPE_LABEL[m.type],
      paymentMethod: 'cash',
      source: 'maintenance',
      sourceId: m.id,
    })
  }

  const driverVehicle = new Map(db.drivers.map((d) => [d.id, d.assignedVehicleId]))
  const driverName = new Map(db.drivers.map((d) => [d.id, d.name]))
  for (const p of db.driverPayments) {
    lines.push({
      id: `dpay:${p.id}`,
      date: p.date,
      vehicleId: driverVehicle.get(p.driverId) ?? null,
      driverId: p.driverId,
      category: 'driver',
      amount: p.amount,
      description: `${DRIVER_PAYMENT_LABEL[p.type]} · ${driverName.get(p.driverId) ?? 'Driver'}`,
      paymentMethod: 'cash',
      source: 'driver',
      sourceId: p.id,
    })
  }

  for (const e of db.expenses) {
    // Defensive: a category owned by another ledger must never enter twice.
    if (CATEGORY_SOURCE[e.category] !== 'direct') continue
    lines.push({
      id: `exp:${e.id}`,
      date: e.date,
      vehicleId: e.vehicleId,
      category: e.category,
      amount: e.amount,
      description: e.description || CATEGORY_LABEL[e.category],
      paymentMethod: e.paymentMethod,
      reference: e.reference,
      source: 'direct',
      sourceId: e.id,
    })
  }

  return lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

/* ------------------------------------------------------------------ */
/* Summaries                                                           */
/* ------------------------------------------------------------------ */

export type CategoryTotals = Record<ExpenseCategory, number>

export function emptyCategoryTotals(): CategoryTotals {
  return {
    diesel: 0, tyres: 0, puncture: 0, service: 0, repairs: 0, fastag: 0,
    driver: 0, insurance: 0, permit: 0, toll: 0, parts: 0, other: 0,
  }
}

export interface OperationsSummary {
  trips: number
  inTransitTrips: number
  cancelledTrips: number
  kilometres: number
  tonnage: number
}

export interface FinancialSummary extends OperationsSummary {
  tripRevenue: number
  otherIncome: number
  grossIncome: number
  expenses: number
  byCategory: CategoryTotals
  netProfit: number
  /** Ratios — `null` whenever the denominator is zero or unknown. */
  costPerKm: number | null
  costPerTon: number | null
  revenuePerKm: number | null
  revenuePerTon: number | null
  profitPerKm: number | null
  profitPerTrip: number | null
  margin: number | null
  /** Fuel */
  litres: number
  fuelCost: number
  mileage: number | null
  fuelCostPerKm: number | null
  fuelCostPerTrip: number | null
}

function operationsOf(trips: Trip[]): OperationsSummary {
  const completed = trips.filter((t) => t.status === 'completed')
  return {
    trips: completed.length,
    inTransitTrips: trips.filter((t) => t.status === 'in-transit').length,
    cancelledTrips: trips.filter((t) => t.status === 'cancelled').length,
    kilometres: sum(completed.map((t) => t.kilometres)),
    tonnage: sum(completed.map((t) => t.tonnage)),
  }
}

/**
 * Tank-to-tank mileage.
 *
 * Distance is measured between the first and last fuel odometer reading in the
 * window; the litres of that first fill are excluded because they powered the
 * distance *before* it. Fewer than two fills, or no distance covered, means the
 * figure is genuinely unknowable — so it returns `null` rather than a guess.
 */
export function computeMileage(
  entries: { odometer: number; litres: number; date: string }[],
): number | null {
  const ordered = entries
    .filter((e) => e.odometer > 0)
    .sort((a, b) => (a.date === b.date ? a.odometer - b.odometer : a.date < b.date ? -1 : 1))
  if (ordered.length < 2) return null
  const distance = ordered[ordered.length - 1].odometer - ordered[0].odometer
  if (distance <= 0) return null
  const consumed = sum(ordered.slice(1).map((e) => e.litres))
  return safeDiv(distance, consumed)
}

export interface SummaryInput {
  trips: Trip[]
  ledger: LedgerLine[]
  fuel: { odometer: number; litres: number; date: string; totalAmount: number }[]
  otherIncome?: number
}

/** Turns a filtered slice of records into the full financial picture. */
export function summarise({ trips, ledger, fuel, otherIncome = 0 }: SummaryInput): FinancialSummary {
  const ops = operationsOf(trips)
  const tripRevenue = sum(trips.filter((t) => t.status === 'completed').map((t) => t.freightAmount))
  const grossIncome = tripRevenue + otherIncome

  const byCategory = emptyCategoryTotals()
  for (const line of ledger) byCategory[line.category] += line.amount
  const expenses = sum(ledger.map((l) => l.amount))
  const netProfit = grossIncome - expenses

  const litresFilled = sum(fuel.map((f) => f.litres))

  return {
    ...ops,
    tripRevenue,
    otherIncome,
    grossIncome,
    expenses,
    byCategory,
    netProfit,
    costPerKm: safeDiv(expenses, ops.kilometres),
    costPerTon: safeDiv(expenses, ops.tonnage),
    revenuePerKm: safeDiv(grossIncome, ops.kilometres),
    revenuePerTon: safeDiv(grossIncome, ops.tonnage),
    profitPerKm: safeDiv(netProfit, ops.kilometres),
    profitPerTrip: safeDiv(netProfit, ops.trips),
    margin: safeDiv(netProfit, grossIncome),
    litres: litresFilled,
    fuelCost: byCategory.diesel,
    mileage: computeMileage(fuel),
    fuelCostPerKm: safeDiv(byCategory.diesel, ops.kilometres),
    fuelCostPerTrip: safeDiv(byCategory.diesel, ops.trips),
  }
}

/* ------------------------------------------------------------------ */
/* Time series                                                         */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  key: string
  label: string
  revenue: number
  expenses: number
  profit: number
  trips: number
  kilometres: number
  tonnage: number
  diesel: number
}

export type Bucket = 'day' | 'week' | 'month'

/** Picks the bucket that yields a readable number of columns for the range. */
export function chooseBucket(range: DateRange, fallbackSpanDays: number): Bucket {
  const span = range.from === '1900-01-01' ? fallbackSpanDays : rangeDays(range)
  if (span <= 31) return 'day'
  if (span <= 120) return 'week'
  return 'month'
}

function bucketKey(iso: string, bucket: Bucket): string {
  if (bucket === 'month') return iso.slice(0, 7)
  if (bucket === 'day') return iso
  const d = fromISO(iso)
  const offset = (d.getDay() + 6) % 7
  return addDays(iso, -offset)
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function bucketLabel(key: string, bucket: Bucket): string {
  if (bucket === 'month') {
    const [y, m] = key.split('-').map(Number)
    return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`
  }
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

/** Builds an ordered, gap-free series so charts never show phantom gaps. */
export function buildSeries(
  trips: Trip[],
  ledger: LedgerLine[],
  bucket: Bucket,
): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>()
  const touch = (iso: string): SeriesPoint => {
    const key = bucketKey(iso, bucket)
    let point = map.get(key)
    if (!point) {
      point = {
        key, label: bucketLabel(key, bucket), revenue: 0, expenses: 0,
        profit: 0, trips: 0, kilometres: 0, tonnage: 0, diesel: 0,
      }
      map.set(key, point)
    }
    return point
  }

  for (const t of trips) {
    if (t.status !== 'completed') continue
    const p = touch(t.date)
    p.revenue += t.freightAmount
    p.trips += 1
    p.kilometres += t.kilometres
    p.tonnage += t.tonnage
  }
  for (const l of ledger) {
    const p = touch(l.date)
    p.expenses += l.amount
    if (l.category === 'diesel') p.diesel += l.amount
  }

  const points = [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
  for (const p of points) p.profit = p.revenue - p.expenses
  return points
}

/* ------------------------------------------------------------------ */
/* Driver money                                                        */
/* ------------------------------------------------------------------ */

export interface DriverLedger {
  salaryPaid: number
  advances: number
  tripPayments: number
  otherPayments: number
  totalPaid: number
  /** Salary accrued over the period the records actually cover. */
  salaryEarned: number
  /** Still owed: earned salary less salary paid and advances drawn against it. */
  pending: number
  monthsOfService: number
  /** The date salary starts accruing from — see the note below. */
  accrualFrom: string
}

/**
 * A driver's running account.
 *
 * Two rules make this figure mean something:
 *
 *  1. **Only salary and advances settle against salary.** Batta (the per-trip
 *     allowance) and one-off payments are operational costs that were paid in
 *     full at the time; treating them as advances would understate what the
 *     driver is still owed.
 *
 *  2. **Accrual starts when the records do**, not at the joining date. A driver
 *     who joined four years ago but whose payments have only been kept here for
 *     nine months has not suddenly grown a four-year liability — that money was
 *     paid, just not in this system. Without this, importing an existing driver
 *     would invent a debt of several lakh on day one.
 *
 * A negative balance means the driver has drawn ahead, which the UI reports as
 * "advanced" rather than as money owed to them.
 */
export function driverLedger(
  payments: { type: string; amount: number; date: string }[],
  salary: number,
  joiningDate: string,
  today: string,
): DriverLedger {
  const of = (type: string) => sum(payments.filter((p) => p.type === type).map((p) => p.amount))
  const salaryPaid = of('salary')
  const advances = of('advance')
  const tripPayments = of('trip-payment')
  const otherPayments = of('other')
  const totalPaid = salaryPaid + advances + tripPayments + otherPayments

  const earliestPayment = payments.reduce<string | null>(
    (earliest, p) => (earliest === null || p.date < earliest ? p.date : earliest),
    null,
  )
  // Accrual begins at the start of the month the first recorded payment falls
  // in. With no payments at all there is no evidence of unpaid salary, so
  // tracking starts from this month rather than inventing arrears back to the
  // joining date.
  const recordsBegin = `${(earliestPayment ?? today).slice(0, 7)}-01`
  const accrualFrom = recordsBegin > joiningDate ? recordsBegin : joiningDate

  const months = Math.max(0, monthsBetween(accrualFrom, today))
  const salaryEarned = salary * months

  return {
    salaryPaid, advances, tripPayments, otherPayments, totalPaid,
    salaryEarned,
    pending: Math.round(salaryEarned - salaryPaid - advances),
    monthsOfService: months,
    accrualFrom,
  }
}

function monthsBetween(from: string, to: string): number {
  const a = fromISO(from)
  const b = fromISO(to)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  return months
}
