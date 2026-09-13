/**
 * Vehicle financials — the page that answers "is this truck actually making
 * money?".
 *
 * Laid out as a statement rather than a dashboard: income on one side, costs on
 * the other, the bottom line stated once, and the per-unit ratios below it.
 * Every ratio guards its denominator and shows a dash rather than a zero when
 * the period has no distance or tonnage behind it.
 */

import { EmptyState, Money, Section, Stat, Stats } from '../../../ui/primitives'
import { Ratio } from '../../shared'
import { safeDiv } from '../../../data/calc'
import { date as formatDate, number as fmtNumber, percent } from '../../../data/format'
import { ChartIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

function Line({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  if (muted && value === 0) return null
  return (
    <div className="ledger-line">
      <span className="ledger-label">{label}</span>
      <span className="ledger-value"><Money value={value} /></span>
    </div>
  )
}

export function FinancialsTab({ vehicle, summary, range }: TabProps) {
  const c = summary.byCategory
  const maintenanceTotal = c.service + c.repairs + c.parts
  const hasActivity = summary.grossIncome > 0 || summary.expenses > 0

  const periodLabel = range.from === '1900-01-01'
    ? 'all time'
    : `${formatDate(range.from)} – ${formatDate(range.to)}`

  if (!hasActivity) {
    return (
      <Section id="v-financials" title="Financials">
        <EmptyState
          icon={<ChartIcon size={20} />}
          title="Nothing to report for this period"
          body={`No trips, fuel or expenses were recorded for ${vehicle.name} between these dates. Change the date range above, or log some activity.`}
        />
      </Section>
    )
  }

  return (
    <div className="stack stack-9">
      <Section
        id="v-bottom-line"
        title="Bottom line"
        description={`Covering ${periodLabel}.`}
      >
        <Stats cols={4} colsMd={2} colsSm={2}>
          <Stat
            label="Net profit"
            hero
            value={<Money value={summary.netProfit} polarity="auto" />}
            tone={summary.netProfit < 0 ? 'negative' : summary.netProfit > 0 ? 'positive' : 'none'}
            sub={
              summary.margin != null
                ? `${percent(summary.margin, 1)} of gross income`
                : 'No income recorded in this period'
            }
          />
          <Stat label="Gross income" value={<Money value={summary.grossIncome} />} sub={`${fmtNumber(summary.trips)} completed trips`} />
          <Stat label="Total expenses" value={<Money value={summary.expenses} />} />
          <Stat
            label="Profit per trip"
            value={<Ratio value={summary.profitPerTrip} tone="auto" />}
            sub="Net profit ÷ completed trips"
          />
        </Stats>
      </Section>

      <Section id="v-statement" title="Income and expenses">
        <div className="statement">
          <div className="panel panel-pad">
            <p className="t-eyebrow" style={{ marginBottom: 12 }}>Income</p>
            <div className="ledger">
              <Line label="Trip revenue" value={summary.tripRevenue} />
              <Line label="Other income" value={summary.otherIncome} />
              <div className="ledger-line ledger-total">
                <span className="ledger-label">Gross income</span>
                <span className="ledger-value"><Money value={summary.grossIncome} /></span>
              </div>
            </div>
            <p className="t-micro t-muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Only completed trips count. Trips still in transit or cancelled are
              excluded until they are marked completed.
            </p>
          </div>

          <div className="panel panel-pad">
            <p className="t-eyebrow" style={{ marginBottom: 12 }}>Expenses</p>
            <div className="ledger">
              <Line label="Diesel" value={c.diesel} />
              <Line label="Driver costs" value={c.driver} />
              <Line label="Maintenance and repairs" value={maintenanceTotal} />
              <Line label="Tyres" value={c.tyres} muted />
              <Line label="Punctures" value={c.puncture} muted />
              <Line label="FASTag" value={c.fastag} muted />
              <Line label="Toll" value={c.toll} muted />
              <Line label="Insurance" value={c.insurance} muted />
              <Line label="Permit and documents" value={c.permit} muted />
              <Line label="Other" value={c.other} muted />
              <div className="ledger-line ledger-total">
                <span className="ledger-label">Total expenses</span>
                <span className="ledger-value"><Money value={summary.expenses} /></span>
              </div>
            </div>
            <p className="t-micro t-muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Diesel comes from fuel entries, maintenance from service records and
              driver costs from payments — each counted once, never twice.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="v-ratios"
        title="Per-unit performance"
        description="What each kilometre and each tonne actually earns and costs."
      >
        <Stats cols={5} colsMd={3} colsSm={2}>
          <Stat label="Revenue per km" value={<Ratio value={summary.revenuePerKm} />} />
          <Stat label="Cost per km" value={<Ratio value={summary.costPerKm} />} />
          <Stat label="Profit per km" value={<Ratio value={summary.profitPerKm} tone="auto" />} />
          <Stat label="Revenue per tonne" value={<Ratio value={summary.revenuePerTon} />} />
          <Stat label="Cost per tonne" value={<Ratio value={summary.costPerTon} />} />
        </Stats>
        {summary.kilometres === 0 && (
          <p className="t-micro t-muted">
            No completed kilometres in this period, so per-kilometre figures cannot
            be worked out and are shown as a dash rather than zero.
          </p>
        )}
      </Section>

      <Section
        id="v-fuel-economics"
        title="Fuel economics"
        description="Diesel is usually the largest single cost, so it is worth watching on its own."
      >
        <Stats cols={4} colsMd={2} colsSm={2}>
          <Stat
            label="Diesel spend"
            value={<Money value={summary.fuelCost} />}
            sub={summary.expenses > 0 ? `${percent(summary.fuelCost / summary.expenses, 1)} of all expenses` : undefined}
          />
          <Stat label="Litres used" value={<span className="num">{fmtNumber(summary.litres, 1)} L</span>} />
          <Stat
            label="Mileage"
            value={summary.mileage != null
              ? <span className="num">{fmtNumber(summary.mileage, 2)} km/L</span>
              : <span className="unavailable">—</span>}
            sub={summary.mileage == null ? 'Needs at least two fills' : 'Tank to tank'}
          />
          <Stat
            label="Diesel per tonne carried"
            value={<Ratio value={safeDiv(summary.fuelCost, summary.tonnage)} />}
          />
        </Stats>
      </Section>
    </div>
  )
}
