/**
 * Analytics — the business-intelligence view.
 *
 * Every figure and every chart is derived from the same records as the fleet
 * pages, filtered by one date range. There are no charts here for decoration:
 * each one answers a question an owner actually asks.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EmptyState, Money, PageHeader, Section, Stat, Stats,
} from '../../ui/primitives'
import { RangeFilter, useRangeState } from '../../ui/RangeFilter'
import {
  BarList, DivergingColumns, GroupedColumns, Legend, MiniColumns, SeriesTable,
  type BarListItem,
} from '../../ui/Charts'
import { Ratio, useToday } from '../shared'
import { useDb } from '../../data/store'
import { useFleetRows, useLedger } from '../../data/selectors'
import {
  buildSeries, chooseBucket, inRange, safeDiv, summarise,
} from '../../data/calc'
import {
  km as formatKm, money, moneyCompact, number as fmtNumber, percent, tonnes,
} from '../../data/format'
import { CATEGORY_LABEL, type ExpenseCategory } from '../../data/types'
import { ChartIcon, ChevronDownIcon } from '../../ui/icons'

const RAMP = ['var(--ramp-3)', 'var(--ramp-2)', 'var(--ramp-4)', 'var(--ramp-1)', 'var(--ramp-5)']

function TableToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="disclosure" onClick={onToggle} aria-expanded={open}>
      <ChevronDownIcon
        size={13}
        style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }}
      />
      {open ? 'Hide the numbers' : label}
    </button>
  )
}

export function AnalyticsPage() {
  const db = useDb()
  const ledger = useLedger()
  const today = useToday()
  const navigate = useNavigate()
  const rangeState = useRangeState(today, 'year')
  const { range } = rangeState

  const [showRevenueTable, setShowRevenueTable] = useState(false)
  const [showProfitTable, setShowProfitTable] = useState(false)

  const scopedTrips = useMemo(() => db.trips.filter((t) => inRange(t.date, range)), [db.trips, range])
  const scopedLedger = useMemo(() => ledger.filter((l) => inRange(l.date, range)), [ledger, range])
  const scopedFuel = useMemo(() => db.fuel.filter((f) => inRange(f.date, range)), [db.fuel, range])

  const summary = useMemo(
    () => summarise({ trips: scopedTrips, ledger: scopedLedger, fuel: scopedFuel }),
    [scopedTrips, scopedLedger, scopedFuel],
  )

  /* The earliest record decides the bucket width when "All time" is selected. */
  const spanDays = useMemo(() => {
    const dates = [...db.trips.map((t) => t.date), ...ledger.map((l) => l.date)].sort()
    if (dates.length === 0) return 30
    return Math.max(1, Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86_400_000))
  }, [db.trips, ledger])

  const bucket = chooseBucket(range, spanDays)
  const series = useMemo(
    () => buildSeries(scopedTrips, scopedLedger, bucket),
    [scopedTrips, scopedLedger, bucket],
  )

  const fleetRows = useFleetRows(range)

  const profitByVehicle = useMemo<BarListItem[]>(
    () => [...fleetRows]
      .sort((a, b) => b.summary.netProfit - a.summary.netProfit)
      .map((r) => ({
        id: r.vehicle.id,
        label: `${r.vehicle.name} · ${r.vehicle.registrationNumber}`,
        value: r.summary.netProfit,
        display: money(r.summary.netProfit),
        meta: r.summary.margin != null
          ? `${percent(r.summary.margin, 1)} margin on ${money(r.summary.grossIncome)} of revenue`
          : 'No revenue in this period',
      })),
    [fleetRows],
  )

  const revenueByVehicle = useMemo<BarListItem[]>(
    () => [...fleetRows]
      .sort((a, b) => b.summary.grossIncome - a.summary.grossIncome)
      .map((r, i) => ({
        id: r.vehicle.id,
        label: r.vehicle.name,
        value: r.summary.grossIncome,
        display: money(r.summary.grossIncome),
        color: RAMP[Math.min(i, RAMP.length - 1)],
        meta: `${fmtNumber(r.summary.trips)} trips · ${formatKm(r.summary.kilometres)}`,
      })),
    [fleetRows],
  )

  const expensesByVehicle = useMemo<BarListItem[]>(
    () => [...fleetRows]
      .sort((a, b) => b.summary.expenses - a.summary.expenses)
      .map((r, i) => ({
        id: r.vehicle.id,
        label: r.vehicle.name,
        value: r.summary.expenses,
        display: money(r.summary.expenses),
        color: RAMP[Math.min(i, RAMP.length - 1)],
        meta: `Diesel ${money(r.summary.byCategory.diesel)} of it`,
      })),
    [fleetRows],
  )

  const costPerKm = useMemo<BarListItem[]>(
    () => [...fleetRows]
      .filter((r) => r.summary.costPerKm != null)
      .sort((a, b) => (b.summary.costPerKm ?? 0) - (a.summary.costPerKm ?? 0))
      .map((r) => ({
        id: r.vehicle.id,
        label: r.vehicle.name,
        value: r.summary.costPerKm ?? 0,
        display: `₹${(r.summary.costPerKm ?? 0).toFixed(2)}`,
        color: 'var(--series-1)',
        meta: r.summary.revenuePerKm != null
          ? `Earns ₹${r.summary.revenuePerKm.toFixed(2)} per km`
          : undefined,
      })),
    [fleetRows],
  )

  const categoryBreakdown = useMemo<BarListItem[]>(() => {
    const entries = (Object.entries(summary.byCategory) as [ExpenseCategory, number][])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
    return entries.map(([category, amount], i) => ({
      id: category,
      label: CATEGORY_LABEL[category],
      value: amount,
      display: money(amount),
      color: RAMP[Math.min(i, RAMP.length - 1)],
      meta: summary.expenses > 0 ? `${percent(amount / summary.expenses, 1)} of expenses` : undefined,
    }))
  }, [summary.byCategory, summary.expenses])

  const hasData = summary.trips > 0 || summary.expenses > 0

  if (db.vehicles.length === 0) {
    return (
      <div className="page stack stack-8">
        <PageHeader title="Analytics" subtitle="Business performance across the fleet" />
        <EmptyState
          icon={<ChartIcon size={20} />}
          title="No data to analyse yet"
          body="Analytics is built from your trips, fuel and expenses. Add a vehicle and log some work, and this page will fill in on its own."
          action={
            <button type="button" className="btn btn-primary" onClick={() => navigate('/fleet')}>
              Go to Fleet
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Analytics"
        subtitle="Revenue, cost and performance across the whole fleet"
        actions={<RangeFilter state={rangeState} />}
      />

      {!hasData ? (
        <EmptyState
          icon={<ChartIcon size={20} />}
          title="Nothing recorded in this period"
          body="No trips, fuel or expenses fall between these dates. Try a wider date range."
        />
      ) : (
        <>
          <Section
            id="a-headline"
            title="Headline"
            description="The whole business over the selected period."
          >
            <Stats cols={4} colsMd={2} colsSm={2}>
              <Stat
                label="Net profit"
                hero
                value={<Money value={summary.netProfit} polarity="auto" />}
                tone={summary.netProfit < 0 ? 'negative' : summary.netProfit > 0 ? 'positive' : 'none'}
                sub={summary.margin != null ? `${percent(summary.margin, 1)} margin` : undefined}
              />
              <Stat label="Total revenue" value={<Money value={summary.grossIncome} />} sub={`${fmtNumber(summary.trips)} completed trips`} />
              <Stat label="Total expenses" value={<Money value={summary.expenses} />} />
              <Stat
                label="Diesel"
                value={<Money value={summary.fuelCost} />}
                sub={summary.expenses > 0 ? `${percent(summary.fuelCost / summary.expenses, 1)} of expenses` : undefined}
              />
            </Stats>

            <Stats cols={4} colsMd={2} colsSm={2}>
              <Stat label="Distance" value={<span className="num">{formatKm(summary.kilometres)}</span>} />
              <Stat label="Tonnage" value={<span className="num">{tonnes(summary.tonnage)}</span>} />
              <Stat label="Revenue per km" value={<Ratio value={summary.revenuePerKm} />} />
              <Stat label="Cost per km" value={<Ratio value={summary.costPerKm} />} />
            </Stats>
          </Section>

          <Section
            id="a-revenue"
            title="Revenue against expenses"
            description="Whether cost is keeping pace with the work coming in."
          >
            <div className="panel panel-pad stack stack-5">
              <Legend
                entries={[
                  { label: 'Revenue', color: 'var(--chart-revenue)' },
                  { label: 'Expenses', color: 'var(--chart-expense)' },
                ]}
              />
              <GroupedColumns
                data={series}
                series={[
                  { key: 'revenue', label: 'Revenue', color: 'var(--chart-revenue)' },
                  { key: 'expenses', label: 'Expenses', color: 'var(--chart-expense)' },
                ]}
                ariaLabel="Revenue against expenses over time"
              />
              <TableToggle
                open={showRevenueTable}
                onToggle={() => setShowRevenueTable((v) => !v)}
                label="Show the numbers"
              />
              {showRevenueTable && (
                <SeriesTable
                  data={series}
                  columns={[
                    { key: 'revenue', label: 'Revenue', format: money },
                    { key: 'expenses', label: 'Expenses', format: money },
                    { key: 'profit', label: 'Profit', format: money },
                  ]}
                />
              )}
            </div>
          </Section>

          <Section
            id="a-profit"
            title="Profit over time"
            description="Bars above the line made money; bars below it lost money."
          >
            <div className="panel panel-pad stack stack-5">
              <DivergingColumns
                data={series}
                valueKey="profit"
                ariaLabel="Profit over time, positive above the zero line and negative below it"
              />
              <TableToggle
                open={showProfitTable}
                onToggle={() => setShowProfitTable((v) => !v)}
                label="Show the numbers"
              />
              {showProfitTable && (
                <SeriesTable
                  data={series}
                  columns={[
                    { key: 'profit', label: 'Profit', format: money },
                    { key: 'trips', label: 'Trips', format: (v) => fmtNumber(v) },
                    { key: 'kilometres', label: 'Kilometres', format: (v) => fmtNumber(v) },
                  ]}
                />
              )}
            </div>
          </Section>

          <Section
            id="a-vehicles"
            title="Vehicle performance"
            description="Which vehicles are carrying the business, and which are not."
          >
            <div className="chart-grid chart-grid-2">
              <div className="panel">
                <div className="panel-head">
                  <span className="t-subhead">Profit by vehicle</span>
                </div>
                <div className="panel-body">
                  <BarList items={profitByVehicle} />
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <span className="t-subhead">Cost per kilometre</span>
                  <span className="t-micro t-muted">Lower is better</span>
                </div>
                <div className="panel-body">
                  {costPerKm.length > 0 ? (
                    <BarList items={costPerKm} format={(v) => `₹${v.toFixed(2)}`} />
                  ) : (
                    <p className="t-micro t-muted">
                      No completed kilometres in this period, so cost per kilometre cannot be worked out.
                    </p>
                  )}
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><span className="t-subhead">Revenue by vehicle</span></div>
                <div className="panel-body"><BarList items={revenueByVehicle} /></div>
              </div>
              <div className="panel">
                <div className="panel-head"><span className="t-subhead">Expenses by vehicle</span></div>
                <div className="panel-body"><BarList items={expensesByVehicle} /></div>
              </div>
            </div>
          </Section>

          <Section
            id="a-costs"
            title="Where the money goes"
            description="Every expense category across the fleet, largest first."
          >
            <div className="panel panel-pad">
              <BarList items={categoryBreakdown} />
            </div>
          </Section>

          <Section
            id="a-volume"
            title="Work done"
            description="Trip volume and tonnage handled, shown separately so neither scale distorts the other."
          >
            <div className="chart-grid chart-grid-2">
              <div className="panel">
                <div className="panel-head">
                  <span className="t-subhead">Trips completed</span>
                  <span className="t-micro t-muted">{fmtNumber(summary.trips)} in total</span>
                </div>
                <div className="panel-body">
                  <MiniColumns data={series} valueKey="trips" ariaLabel="Trips completed" color="var(--series-2)" />
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <span className="t-subhead">Tonnage handled</span>
                  <span className="t-micro t-muted">{tonnes(summary.tonnage)} in total</span>
                </div>
                <div className="panel-body">
                  <MiniColumns
                    data={series}
                    valueKey="tonnage"
                    ariaLabel="Tonnage handled"
                    color="var(--series-5)"
                    valueFormat={(v) => fmtNumber(v)}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="a-fuel"
            title="Diesel"
            description="The largest controllable cost in the business."
          >
            <div className="panel panel-pad stack stack-6">
              <Stats cols={4} colsMd={2} colsSm={2}>
                <Stat label="Diesel spend" value={<Money value={summary.fuelCost} />} />
                <Stat label="Litres" value={<span className="num">{fmtNumber(summary.litres, 0)} L</span>} />
                <Stat label="Diesel per km" value={<Ratio value={summary.fuelCostPerKm} />} />
                <Stat
                  label="Average rate paid"
                  value={
                    <Ratio value={safeDiv(summary.fuelCost, summary.litres)} suffix=" / L" />
                  }
                />
              </Stats>
              <MiniColumns
                data={series}
                valueKey="diesel"
                ariaLabel="Diesel spend over time"
                color="var(--series-1)"
                valueFormat={moneyCompact}
                height={170}
              />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
