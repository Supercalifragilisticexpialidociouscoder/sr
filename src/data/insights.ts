/**
 * Observations the numbers support, and nothing else.
 *
 * Every insight here is a comparison between figures the product already
 * computed. None of them guess at a cause: the product can say a truck's cost
 * per kilometre rose 11%, because it can subtract; it cannot say why, so it
 * does not. An insight that cannot be derived is simply not shown.
 */

import { safeDiv, summarise, type DateRange, type FinancialSummary } from './calc'
import { scopeRecords } from './selectors'
import { money, moneyPrecise, number as fmtNumber, percent } from './format'
import type { Database, LedgerLine } from './types'
import { CATEGORY_LABEL } from './types'

export type InsightTone = 'positive' | 'neutral' | 'warning'

export interface Insight {
  id: string
  tone: InsightTone
  title: string
  detail?: string
  href?: string
}

export interface Delta {
  key: string
  label: string
  current: number
  previous: number
  change: number | null
  /** Whether an increase is good news for this measure. */
  upIsGood: boolean
  format: (v: number) => string
}

/* ------------------------------------------------------------------ */
/* Month on month                                                      */
/* ------------------------------------------------------------------ */

export function compare(current: FinancialSummary, previous: FinancialSummary): Delta[] {
  const rows: [string, string, number, number, boolean, (v: number) => string][] = [
    ['revenue', 'Revenue', current.grossIncome, previous.grossIncome, true, money],
    ['expenses', 'Expenses', current.expenses, previous.expenses, false, money],
    ['profit', 'Profit', current.netProfit, previous.netProfit, true, money],
    ['trips', 'Trips', current.trips, previous.trips, true, (v) => fmtNumber(v)],
    ['km', 'Kilometres', current.kilometres, previous.kilometres, true, (v) => `${fmtNumber(v)} km`],
    ['tonnage', 'Tonnage', current.tonnage, previous.tonnage, true, (v) => `${fmtNumber(v, 1)} t`],
    ['diesel', 'Diesel', current.fuelCost, previous.fuelCost, false, money],
    ['fastag', 'FASTag', current.fastagCost, previous.fastagCost, false, money],
    ['maintenance', 'Maintenance',
      current.byCategory.service + current.byCategory.repairs + current.byCategory.parts,
      previous.byCategory.service + previous.byCategory.repairs + previous.byCategory.parts,
      false, money],
  ]
  return rows.map(([key, label, cur, prev, upIsGood, format]) => ({
    key, label, current: cur, previous: prev, upIsGood, format,
    // A change from nothing is not a percentage, it is a start.
    change: prev === 0 ? null : (cur - prev) / Math.abs(prev),
  }))
}

/** Whether a delta reads as good news, for colouring it. */
export function deltaTone(d: Delta): InsightTone {
  if (d.change == null || Math.abs(d.change) < 0.005) return 'neutral'
  const up = d.change > 0
  return up === d.upIsGood ? 'positive' : 'warning'
}

/* ------------------------------------------------------------------ */
/* Insights                                                            */
/* ------------------------------------------------------------------ */

interface VehicleRow {
  id: string
  name: string
  summary: FinancialSummary
}

function vehicleRows(db: Database, ledger: LedgerLine[], range: DateRange): VehicleRow[] {
  return db.vehicles.map((v) => {
    const r = scopeRecords(db, ledger, { vehicleId: v.id, range })
    return {
      id: v.id,
      name: v.name || v.registrationNumber,
      summary: summarise({ trips: r.trips, ledger: r.ledger, fuel: r.fuel }),
    }
  })
}

/** The middle value, which a single bad month cannot drag around. */
function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function buildInsights(
  db: Database,
  ledger: LedgerLine[],
  range: DateRange,
  previousRange: DateRange | null,
): Insight[] {
  const out: Insight[] = []
  const rows = vehicleRows(db, ledger, range).filter((r) => r.summary.grossIncome > 0 || r.summary.expenses > 0)
  if (rows.length === 0) return out

  const total = summarise({
    ...scopeRecords(db, ledger, { vehicleId: null, range }),
  })

  /* Who earned the most ------------------------------------------------ */
  const byProfit = [...rows].sort((a, b) => b.summary.netProfit - a.summary.netProfit)
  const best = byProfit[0]
  if (best && best.summary.netProfit > 0) {
    out.push({
      id: 'best-profit', tone: 'positive',
      title: `${best.name} made the most money this period`,
      detail: `${money(best.summary.netProfit)} profit on ${money(best.summary.grossIncome)} of revenue across ${fmtNumber(best.summary.trips)} trips.`,
      href: `/fleet/vehicles/${best.id}`,
    })
  }

  /* Who lost money ------------------------------------------------------ */
  for (const row of byProfit.filter((r) => r.summary.netProfit < 0)) {
    out.push({
      id: `loss-${row.id}`, tone: 'warning',
      title: `${row.name} ran at a loss of ${money(Math.abs(row.summary.netProfit))}`,
      detail: row.summary.grossIncome > 0
        ? `${money(row.summary.expenses)} of costs against ${money(row.summary.grossIncome)} of revenue.`
        : `${money(row.summary.expenses)} of costs with no revenue recorded against it.`,
      href: `/fleet/vehicles/${row.id}/financials`,
    })
  }

  /* Where the money went ------------------------------------------------ */
  if (total.expenses > 0) {
    const largest = (Object.entries(total.byCategory) as [keyof typeof total.byCategory, number][])
      .sort((a, b) => b[1] - a[1])[0]
    if (largest && largest[1] > 0) {
      out.push({
        id: 'largest-cost', tone: 'neutral',
        title: `${CATEGORY_LABEL[largest[0]]} was ${percent(largest[1] / total.expenses, 0)} of all costs`,
        detail: `${money(largest[1])} of ${money(total.expenses)} total expenses.`,
      })
    }
  }

  /* Diesel efficiency against the rest of the fleet ---------------------- */
  const perKm = rows
    .filter((r) => r.summary.fuelCostPerKm != null)
    .map((r) => ({ row: r, value: r.summary.fuelCostPerKm as number }))
  const mid = median(perKm.map((p) => p.value))
  if (mid != null && perKm.length >= 3) {
    for (const { row, value } of perKm) {
      if (value > mid * 1.25) {
        out.push({
          id: `diesel-${row.id}`, tone: 'warning',
          title: `${row.name} burns more diesel per kilometre than the rest of the fleet`,
          detail: `${moneyPrecise(value)} per km against a fleet middle of ${moneyPrecise(mid)}.`,
          href: `/fleet/vehicles/${row.id}/fuel`,
        })
      }
    }
  }

  /* Who did the most work ----------------------------------------------- */
  const byTrips = [...rows].sort((a, b) => b.summary.trips - a.summary.trips)[0]
  if (byTrips && byTrips.summary.trips > 0 && byTrips.id !== best?.id) {
    out.push({
      id: 'most-trips', tone: 'neutral',
      title: `${byTrips.name} ran the most trips`,
      detail: `${fmtNumber(byTrips.summary.trips)} trips covering ${fmtNumber(byTrips.summary.kilometres)} km.`,
      href: `/fleet/vehicles/${byTrips.id}/trips`,
    })
  }

  /* Against last period -------------------------------------------------- */
  if (previousRange) {
    const prev = summarise({ ...scopeRecords(db, ledger, { vehicleId: null, range: previousRange }) })
    if (prev.grossIncome > 0 || prev.expenses > 0) {
      const deltas = compare(total, prev)
      const revenue = deltas.find((d) => d.key === 'revenue')
      const expenses = deltas.find((d) => d.key === 'expenses')
      if (revenue?.change != null && expenses?.change != null) {
        const tone: InsightTone =
          revenue.change > expenses.change ? 'positive' : revenue.change < expenses.change ? 'warning' : 'neutral'
        out.push({
          id: 'vs-previous', tone,
          title: revenue.change >= 0
            ? `Revenue ${revenue.change === 0 ? 'held level' : `rose ${percent(revenue.change, 1)}`} while costs ${expenses.change >= 0 ? `rose ${percent(expenses.change, 1)}` : `fell ${percent(Math.abs(expenses.change), 1)}`}`
            : `Revenue fell ${percent(Math.abs(revenue.change), 1)} while costs ${expenses.change >= 0 ? `rose ${percent(expenses.change, 1)}` : `fell ${percent(Math.abs(expenses.change), 1)}`}`,
          detail: `${money(total.grossIncome)} against ${money(prev.grossIncome)} last period.`,
        })
      }

      /* A vehicle whose running cost moved materially -------------------- */
      const prevRows = new Map(vehicleRows(db, ledger, previousRange).map((r) => [r.id, r]))
      for (const row of rows) {
        const before = prevRows.get(row.id)
        const now = row.summary.costPerKm
        const then = before?.summary.costPerKm
        if (now == null || then == null || then === 0) continue
        const change = (now - then) / then
        if (Math.abs(change) < 0.1) continue
        out.push({
          id: `costkm-${row.id}`,
          tone: change > 0 ? 'warning' : 'positive',
          title: `${row.name}'s cost per km ${change > 0 ? 'rose' : 'fell'} ${percent(Math.abs(change), 1)}`,
          detail: `${moneyPrecise(now)} per km, from ${moneyPrecise(then)} last period.`,
          href: `/fleet/vehicles/${row.id}/financials`,
        })
      }
    }
  }

  /* Work with no revenue behind it --------------------------------------- */
  const unbilled = rows.filter((r) => r.summary.expenses > 0 && r.summary.grossIncome === 0 && r.summary.trips === 0)
  for (const row of unbilled) {
    out.push({
      id: `norevenue-${row.id}`, tone: 'warning',
      title: `${row.name} has costs but no trips recorded`,
      detail: `${money(row.summary.expenses)} spent with nothing logged against it. The trip sheet for this period may not have been imported.`,
      href: `/fleet/vehicles/${row.id}`,
    })
  }

  const order: Record<InsightTone, number> = { warning: 0, positive: 1, neutral: 2 }
  return out.sort((a, b) => order[a.tone] - order[b.tone])
}

export { safeDiv }
