/**
 * Overview — the page the product opens on.
 *
 * It answers one question at the top ("how did the business do?") and then
 * lets that answer be taken apart: which truck, which cost, which transaction.
 * Everything on it is governed by the one period control in the header, so
 * there is never a figure on screen describing a different window.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, LinkButton } from '../../ui/Button'
import {
  EmptyState, Figure, Figures, Money, PageHeader, Readout, Section,
} from '../../ui/primitives'
import { PeriodBar } from '../../ui/PeriodBar'
import { BarList, DivergingColumns, GroupedColumns, Legend, SeriesTable, type BarListItem } from '../../ui/Charts'
import { DataTable, type Column } from '../../ui/DataTable'
import { Ratio, useToday, vehicleColor } from '../shared'
import { useDb } from '../../data/store'
import { useLedger, scopeRecords } from '../../data/selectors'
import { buildSeries, chooseBucket, rangeDays, summarise, type FinancialSummary } from '../../data/calc'
import { monthRange, previousMonth, usePeriod } from '../../data/period'
import { buildInsights, compare, deltaTone, type Delta } from '../../data/insights'
import {
  km as formatKm, marginNote, money, number as fmtNumber, percent, tonnes,
} from '../../data/format'
import { CATEGORY_LABEL, CATEGORY_ORDER, type ExpenseCategory } from '../../data/types'
import {
  ArrowDownRightIcon, ArrowUpRightIcon, ChevronRightIcon, FileIcon, InboxIcon, PlusIcon,
} from '../../ui/icons'
import { TransactionsDrawer, type DrillTarget } from './TransactionsDrawer'

type SortKey = 'profit' | 'revenue' | 'expenses' | 'trips' | 'tonnage' | 'costPerKm'

interface VehicleRow {
  id: string
  name: string
  registration: string
  index: number
  summary: FinancialSummary
}

function DeltaTag({ delta }: { delta: Delta }) {
  if (delta.change == null) return <span className="delta delta-neutral">new</span>
  const tone = deltaTone(delta)
  const up = delta.change > 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  if (Math.abs(delta.change) < 0.005) return <span className="delta delta-neutral">level</span>
  return (
    <span className={`delta delta-${tone}`}>
      <Icon size={11} />
      {percent(Math.abs(delta.change), 1)}
    </span>
  )
}

export function OverviewPage() {
  const db = useDb()
  const ledger = useLedger()
  const today = useToday()
  const navigate = useNavigate()
  const period = usePeriod(db, today)
  const [sort, setSort] = useState<SortKey>('profit')
  const [drill, setDrill] = useState<DrillTarget | null>(null)
  const [showNumbers, setShowNumbers] = useState(false)

  const hasData = db.trips.length > 0 || db.fuel.length > 0
    || db.expenses.length > 0 || db.maintenance.length > 0

  const summary = useMemo(
    () => summarise({ ...scopeRecords(db, ledger, { vehicleId: null, range: period.range }) }),
    [db, ledger, period.range],
  )

  /* Month on month only makes sense when a month is on screen. */
  const previousRange = period.mode === 'month' ? monthRange(previousMonth(period.month)) : null
  const previousSummary = useMemo(
    () => (previousRange ? summarise({ ...scopeRecords(db, ledger, { vehicleId: null, range: previousRange }) }) : null),
    [db, ledger, previousRange],
  )
  /* A comparison against a month that holds nothing is not a comparison — it
     would tag every figure "new" and say nothing. */
  const comparable = previousSummary != null
    && (previousSummary.grossIncome > 0 || previousSummary.expenses > 0)
  const deltas = useMemo(
    () => (comparable && previousSummary ? compare(summary, previousSummary) : []),
    [comparable, summary, previousSummary],
  )
  const deltaFor = (key: string) => deltas.find((d) => d.key === key)

  const rows = useMemo<VehicleRow[]>(() => db.vehicles.map((v, index) => {
    const r = scopeRecords(db, ledger, { vehicleId: v.id, range: period.range })
    return {
      id: v.id, index,
      name: v.name || v.registrationNumber,
      registration: v.registrationNumber,
      summary: summarise({ trips: r.trips, ledger: r.ledger, fuel: r.fuel }),
    }
  }), [db, ledger, period.range])

  const sorted = useMemo(() => {
    const value = (r: VehicleRow) => {
      switch (sort) {
        case 'revenue': return r.summary.grossIncome
        case 'expenses': return r.summary.expenses
        case 'trips': return r.summary.trips
        case 'tonnage': return r.summary.tonnage
        case 'costPerKm': return r.summary.costPerKm ?? -1
        default: return r.summary.netProfit
      }
    }
    const worked = (r: VehicleRow) => r.summary.trips > 0 || r.summary.expenses > 0
    // A truck that did nothing this period sorts below the ones that did,
    // whichever column is chosen — otherwise an idle vehicle sitting at zero
    // tops a "highest profit" sort ahead of one that actually ran.
    return [...rows].sort((a, b) => {
      if (worked(a) !== worked(b)) return worked(a) ? -1 : 1
      return value(b) - value(a)
    })
  }, [rows, sort])

  const series = useMemo(() => {
    const scoped = scopeRecords(db, ledger, { vehicleId: null, range: period.range })
    const bucket = chooseBucket(period.range, rangeDays(period.range))
    return buildSeries(scoped.trips, scoped.ledger, bucket)
  }, [db, ledger, period.range])

  const breakdown = useMemo<BarListItem[]>(() => CATEGORY_ORDER
    .map((c) => ({ category: c, amount: summary.byCategory[c] }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((e) => ({
      id: e.category,
      label: CATEGORY_LABEL[e.category],
      value: e.amount,
      display: money(e.amount),
      meta: summary.expenses > 0 ? `${percent(e.amount / summary.expenses, 1)} of expenses` : undefined,
    })), [summary])

  const insights = useMemo(
    () => buildInsights(db, ledger, period.range, previousRange),
    [db, ledger, period.range, previousRange],
  )

  /* ---------------------------------------------------------------- */

  if (!hasData) {
    return (
      <div className="page stack stack-9">
        <PageHeader title="Business overview" />
        <EmptyState
          icon={<InboxIcon size={22} />}
          title="Import your first company report"
          body="Upload the Excel file your company sends and it will be read, checked and organised into trips, diesel, AdBlue, FASTag, expenses and vehicle profitability — with a monthly report ready at the end of it."
          action={
            <div className="row row-4 row-wrap">
              <LinkButton to="/import" variant="primary" icon={<PlusIcon size={15} />}>Import Excel</LinkButton>
              <LinkButton to="/fleet">Or add records by hand</LinkButton>
            </div>
          }
        />
      </div>
    )
  }

  const columns: Column<VehicleRow>[] = [
    {
      key: 'vehicle', header: 'Vehicle', mobile: 'title',
      render: (r) => (
        <span className="row row-4" style={{ minWidth: 0 }}>
          <span className="nav-vehicle-spine" style={{ ['--vehicle-color' as string]: vehicleColor(r.index) }} aria-hidden="true" />
          <span className="stack" style={{ gap: 1, minWidth: 0 }}>
            <span className="td-strong truncate">{r.name}</span>
            <span className="t-micro t-muted mono truncate">{r.registration}</span>
          </span>
        </span>
      ),
    },
    { key: 'revenue', header: 'Revenue', numeric: true, render: (r) => <Money value={r.summary.grossIncome} /> },
    { key: 'expenses', header: 'Expenses', numeric: true, render: (r) => <Money value={r.summary.expenses} /> },
    {
      key: 'profit', header: 'Profit', numeric: true, mobile: 'amount',
      render: (r) => <Money value={r.summary.netProfit} polarity="auto" className="td-strong" />,
    },
    { key: 'trips', header: 'Trips', numeric: true, render: (r) => fmtNumber(r.summary.trips) },
    { key: 'tonnage', header: 'Tonnage', numeric: true, render: (r) => tonnes(r.summary.tonnage) },
    { key: 'km', header: 'KM', numeric: true, render: (r) => formatKm(r.summary.kilometres) },
    { key: 'costPerKm', header: 'Cost / km', numeric: true, render: (r) => <Ratio value={r.summary.costPerKm} /> },
  ]

  const SORTS: { id: SortKey; label: string }[] = [
    { id: 'profit', label: 'Profit' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'trips', label: 'Trips' },
    { id: 'tonnage', label: 'Tonnage' },
    { id: 'costPerKm', label: 'Cost / km' },
  ]

  const empty = summary.grossIncome === 0 && summary.expenses === 0

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Business overview"
        actions={
          <>
            <LinkButton to="/reports" icon={<FileIcon size={15} />}>Monthly report</LinkButton>
            <LinkButton to="/import" variant="primary" icon={<PlusIcon size={15} />}>Import Excel</LinkButton>
          </>
        }
      />

      <PeriodBar state={period} db={db} today={today} />

      {empty ? (
        <EmptyState
          icon={<InboxIcon size={22} />}
          title={`Nothing recorded in ${period.label}`}
          body="No trips, diesel or expenses fall in this period. Step to another month, or import the spreadsheet for it."
          action={<LinkButton to="/import" variant="primary">Import Excel</LinkButton>}
        />
      ) : (
        <>
          <Section id="summary" title={period.label}>
            <Readout
              label="Net profit"
              value={<Money value={summary.netProfit} polarity="auto" display />}
              tone={summary.netProfit < 0 ? 'negative' : summary.netProfit > 0 ? 'positive' : 'none'}
              note={[
                marginNote(summary.netProfit, summary.grossIncome, summary.expenses),
                comparable && previousSummary ? `against ${money(previousSummary.netProfit)} last month` : null,
              ].filter(Boolean).join(' · ')}
            >
              <Figures cols={2}>
                <Figure
                  label="Revenue" value={<Money value={summary.grossIncome} />}
                  sub={deltaFor('revenue') ? <DeltaTag delta={deltaFor('revenue')!} /> : undefined}
                />
                <Figure label="Trips" value={fmtNumber(summary.trips)}
                  sub={deltaFor('trips') ? <DeltaTag delta={deltaFor('trips')!} /> : undefined} />
                <Figure
                  label="Expenses" value={<Money value={summary.expenses} />}
                  sub={deltaFor('expenses') ? <DeltaTag delta={deltaFor('expenses')!} /> : undefined}
                />
                <Figure label="Kilometres" value={formatKm(summary.kilometres)}
                  sub={deltaFor('km') ? <DeltaTag delta={deltaFor('km')!} /> : undefined} />
                <Figure
                  label="Diesel" value={<Money value={summary.fuelCost} />}
                  sub={deltaFor('diesel') ? <DeltaTag delta={deltaFor('diesel')!} /> : undefined}
                />
                <Figure label="Tonnage" value={tonnes(summary.tonnage)}
                  sub={deltaFor('tonnage') ? <DeltaTag delta={deltaFor('tonnage')!} /> : undefined} />
              </Figures>
            </Readout>
          </Section>

          <Section
            id="trend"
            title="Revenue against expenses"
            actions={
              <button type="button" className="disclosure" onClick={() => setShowNumbers((v) => !v)} aria-expanded={showNumbers}>
                {showNumbers ? 'Hide the numbers' : 'Show the numbers'}
              </button>
            }
          >
            <div className="panel panel-pad stack stack-6">
              <Legend entries={[
                { label: 'Revenue', color: 'var(--chart-revenue)' },
                { label: 'Expenses', color: 'var(--chart-expense)' },
              ]} />
              <GroupedColumns
                data={series}
                series={[
                  { key: 'revenue', label: 'Revenue', color: 'var(--chart-revenue)' },
                  { key: 'expenses', label: 'Expenses', color: 'var(--chart-expense)' },
                ]}
                ariaLabel="Revenue against expenses over the selected period"
              />
              <hr className="rule" />
              <span className="t-label">Profit trend</span>
              <DivergingColumns
                data={series}
                valueKey="profit"
                height={168}
                ariaLabel="Profit over the selected period, positive above the zero line"
              />
              {showNumbers && (
                <SeriesTable
                  data={series}
                  columns={[
                    { key: 'revenue', label: 'Revenue', format: money },
                    { key: 'expenses', label: 'Expenses', format: money },
                    { key: 'profit', label: 'Profit', format: money },
                    { key: 'trips', label: 'Trips', format: (v) => fmtNumber(v) },
                  ]}
                />
              )}
            </div>
          </Section>

          <Section
            id="vehicles"
            title="Vehicle performance"
            count={rows.length}
            actions={
              <div className="segment" role="group" aria-label="Sort vehicles by">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`segment-item${sort === s.id ? ' segment-on' : ''}`}
                    onClick={() => setSort(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            }
          >
            <DataTable
              rows={sorted}
              columns={columns}
              getKey={(r) => r.id}
              onRowClick={(r) => navigate(`/fleet/vehicles/${r.id}`)}
              caption="Vehicle performance for the selected period"
            />
          </Section>

          <Section
            id="breakdown"
            title="Where the money went"
            note="Select a head of expenditure to see the transactions behind it."
          >
            <div className="panel panel-pad">
              <BarList
                items={breakdown}
                onSelect={(id) => setDrill({ category: id as ExpenseCategory })}
              />
            </div>
          </Section>

          {insights.length > 0 && (
            <Section id="insights" title="What the numbers say" count={insights.length}>
              <div className="insights">
                {insights.slice(0, 6).map((insight) => {
                  const body = (
                    <>
                      <span className={`insight-mark`} aria-hidden="true" />
                      <span className="stack stack-2" style={{ minWidth: 0 }}>
                        <span className="insight-title">{insight.title}</span>
                        {insight.detail && <span className="insight-detail">{insight.detail}</span>}
                      </span>
                      {insight.href && <ChevronRightIcon size={15} />}
                    </>
                  )
                  return insight.href ? (
                    <Link key={insight.id} to={insight.href} className={`insight insight-${insight.tone}`}>{body}</Link>
                  ) : (
                    <div key={insight.id} className={`insight insight-${insight.tone}`}>{body}</div>
                  )
                })}
              </div>
            </Section>
          )}

          <div className="row row-4 row-wrap">
            <LinkButton to="/reports" icon={<FileIcon size={15} />}>
              Open the {period.label} report
            </LinkButton>
            <Button onClick={() => navigate('/fleet')}>Open the fleet</Button>
          </div>
        </>
      )}

      <TransactionsDrawer target={drill} range={period.range} onClose={() => setDrill(null)} />
    </div>
  )
}
