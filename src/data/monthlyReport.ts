/**
 * The monthly fleet performance report.
 *
 * Assembled once, here, from the same records every other screen reads. The
 * on-screen report, its CSV and the figures on the overview are therefore the
 * same numbers — there is no second calculation anywhere that could drift.
 */

import { safeDiv, summarise, type DateRange, type FinancialSummary } from './calc'
import { scopeRecords } from './selectors'
import { buildInsights, compare, type Delta, type Insight } from './insights'
import { monthLabel } from './period'
import type { Database, ExpenseCategory, LedgerLine } from './types'
import { CATEGORY_ORDER } from './types'

export interface ReportVehicleRow {
  id: string
  name: string
  registration: string
  trips: number
  kilometres: number
  tonnage: number
  revenue: number
  diesel: number
  adblue: number
  fastag: number
  driver: number
  maintenance: number
  otherExpenses: number
  expenses: number
  profit: number
  profitPerKm: number | null
  costPerKm: number | null
}

export interface TopPerformer {
  label: string
  vehicle: string | null
  value: string
}

export interface MonthlyReport {
  title: string
  periodLabel: string
  range: DateRange
  generatedAt: string
  summary: FinancialSummary
  previous: FinancialSummary | null
  deltas: Delta[]
  vehicles: ReportVehicleRow[]
  expenses: { category: ExpenseCategory; amount: number; share: number }[]
  operations: {
    trips: number
    kilometres: number
    tonnage: number
    tonnagePerTrip: number | null
    revenuePerTrip: number | null
    revenuePerTon: number | null
    costPerKm: number | null
    profitPerKm: number | null
  }
  topPerformers: TopPerformer[]
  insights: Insight[]
  hasData: boolean
}

function maintenanceOf(s: FinancialSummary): number {
  return s.byCategory.service + s.byCategory.repairs + s.byCategory.parts
    + s.byCategory.tyres + s.byCategory.puncture
}

function otherOf(s: FinancialSummary): number {
  return s.byCategory.toll + s.byCategory.insurance + s.byCategory.documents + s.byCategory.other
}

export function buildMonthlyReport(
  db: Database,
  ledger: LedgerLine[],
  range: DateRange,
  periodLabel: string,
  previousRange: DateRange | null,
): MonthlyReport {
  const summary = summarise({ ...scopeRecords(db, ledger, { vehicleId: null, range }) })
  const previousRaw = previousRange
    ? summarise({ ...scopeRecords(db, ledger, { vehicleId: null, range: previousRange }) })
    : null
  // Only a period that actually holds records is worth comparing against.
  const previous = previousRaw && (previousRaw.grossIncome > 0 || previousRaw.expenses > 0)
    ? previousRaw
    : null

  const vehicles: ReportVehicleRow[] = db.vehicles
    .map((v) => {
      const r = scopeRecords(db, ledger, { vehicleId: v.id, range })
      const s = summarise({ trips: r.trips, ledger: r.ledger, fuel: r.fuel })
      return {
        id: v.id,
        name: v.name || v.registrationNumber,
        registration: v.registrationNumber,
        trips: s.trips,
        kilometres: s.kilometres,
        tonnage: s.tonnage,
        revenue: s.grossIncome,
        diesel: s.byCategory.diesel,
        adblue: s.byCategory.adblue,
        fastag: s.byCategory.fastag,
        driver: s.byCategory.driver,
        maintenance: maintenanceOf(s),
        otherExpenses: otherOf(s),
        expenses: s.expenses,
        profit: s.netProfit,
        profitPerKm: s.profitPerKm,
        costPerKm: s.costPerKm,
      }
    })
    // A vehicle that did nothing this month is not part of this month's report.
    .filter((v) => v.revenue > 0 || v.expenses > 0)
    .sort((a, b) => b.profit - a.profit)

  const expenses = CATEGORY_ORDER
    .map((category) => ({
      category,
      amount: summary.byCategory[category],
      share: summary.expenses > 0 ? summary.byCategory[category] / summary.expenses : 0,
    }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const pick = (
    label: string,
    value: (v: ReportVehicleRow) => number | null,
    format: (v: ReportVehicleRow) => string,
    lowest = false,
  ): TopPerformer => {
    const eligible = vehicles.filter((v) => value(v) != null)
    if (eligible.length === 0) return { label, vehicle: null, value: '—' }
    const best = eligible.reduce((a, b) => {
      const av = value(a) as number
      const bv = value(b) as number
      return (lowest ? bv < av : bv > av) ? b : a
    })
    return { label, vehicle: best.name, value: format(best) }
  }

  return {
    title: 'Monthly Fleet Performance Report',
    periodLabel,
    range,
    generatedAt: new Date().toISOString(),
    summary,
    previous,
    deltas: previous ? compare(summary, previous) : [],
    vehicles,
    expenses,
    operations: {
      trips: summary.trips,
      kilometres: summary.kilometres,
      tonnage: summary.tonnage,
      tonnagePerTrip: safeDiv(summary.tonnage, summary.trips),
      revenuePerTrip: safeDiv(summary.grossIncome, summary.trips),
      revenuePerTon: summary.revenuePerTon,
      costPerKm: summary.costPerKm,
      profitPerKm: summary.profitPerKm,
    },
    topPerformers: [
      pick('Highest revenue', (v) => v.revenue, (v) => fmtCurrency(v.revenue)),
      pick('Highest profit', (v) => v.profit, (v) => fmtCurrency(v.profit)),
      pick('Most trips', (v) => v.trips, (v) => `${v.trips}`),
      pick('Highest tonnage', (v) => v.tonnage, (v) => `${round(v.tonnage)} t`),
      pick('Lowest cost per km', (v) => v.costPerKm, (v) => `₹${(v.costPerKm ?? 0).toFixed(2)}`, true),
      pick('Highest diesel spend', (v) => v.diesel, (v) => fmtCurrency(v.diesel)),
    ],
    insights: buildInsights(db, ledger, range, previousRange),
    hasData: summary.grossIncome > 0 || summary.expenses > 0,
  }
}

function fmtCurrency(v: number): string {
  return `₹${Math.round(v).toLocaleString('en-IN')}`
}

function round(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

export { monthLabel }
