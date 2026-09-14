/**
 * Vehicle financials — the page that answers "is this truck making money?".
 *
 * Set as a statement, not a dashboard: income on one side, costs on the other,
 * the bottom line stated once, and the per-unit ratios under it. No leading
 * figure here — the page already has one above the tabs, and a view gets one.
 */

import { EmptyState, Figure, Figures, Money, Section } from '../../../ui/primitives'
import { Ratio } from '../../shared'
import { safeDiv } from '../../../data/calc'
import { date as formatDate, number as fmtNumber, percent } from '../../../data/format'
import { ChartIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

function Line({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  if (muted && value === 0) return null
  return <Figure label={label} value={<Money value={value} />} />
}

export function FinancialsTab({ vehicle, summary, range }: TabProps) {
  const c = summary.byCategory
  const maintenanceTotal = c.service + c.repairs + c.parts
  const hasActivity = summary.grossIncome > 0 || summary.expenses > 0

  const period = range.from === '1900-01-01'
    ? 'all time'
    : `${formatDate(range.from)} – ${formatDate(range.to)}`

  if (!hasActivity) {
    return (
      <Section id="v-financials" title="Financials">
        <EmptyState
          icon={<ChartIcon size={22} />}
          title="Nothing to report for this period"
          body={`No trips, fuel or expenses were recorded for ${vehicle.name} between these dates. Widen the date range above, or log some work.`}
        />
      </Section>
    )
  }

  return (
    <div className="stack stack-9">
      <Section id="v-statement" title={`Statement · ${period}`}>
        <div className="statement">
          <div className="panel panel-pad stack stack-4">
            <span className="t-label">Income</span>
            <Figures>
              <Line label="Trip revenue" value={summary.tripRevenue} />
              <Line label="Other income" value={summary.otherIncome} />
              <Figure label="Gross income" value={<Money value={summary.grossIncome} />} total />
            </Figures>
            <p className="section-note">
              Only completed trips count. Work still in transit, or cancelled, is
              excluded until it is marked completed.
            </p>
          </div>

          <div className="panel panel-pad stack stack-4">
            <span className="t-label">Expenses</span>
            <Figures>
              <Line label="Diesel" value={c.diesel} />
              <Line label="AdBlue" value={c.adblue} muted />
              <Line label="Driver costs" value={c.driver} />
              <Line label="Maintenance and repairs" value={maintenanceTotal} muted />
              <Line label="Tyres" value={c.tyres} muted />
              <Line label="Punctures" value={c.puncture} muted />
              <Line label="FASTag" value={c.fastag} muted />
              <Line label="Toll" value={c.toll} muted />
              <Line label="Insurance" value={c.insurance} muted />
              <Line label="Documents" value={c.documents} muted />
              <Line label="Other" value={c.other} muted />
              <Figure label="Total expenses" value={<Money value={summary.expenses} />} total />
            </Figures>
            <p className="section-note">
              Diesel comes from fuel entries, maintenance from service records and
              driver costs from payments — each counted once, never twice.
            </p>
          </div>
        </div>
      </Section>

      <Section id="v-bottom" title="Bottom line">
        <Figures cols={3} className="panel panel-pad">
          <Figure
            label="Net profit"
            value={<Money value={summary.netProfit} polarity="auto" />}
            sub={summary.margin != null ? percent(summary.margin, 1) : undefined}
          />
          <Figure label="Profit per trip" value={<Ratio value={summary.profitPerTrip} tone="auto" />} />
          <Figure label="Profit per km" value={<Ratio value={summary.profitPerKm} tone="auto" />} />
        </Figures>
      </Section>

      <Section
        id="v-ratios"
        title="Per-unit performance"
        note={
          summary.kilometres === 0
            ? 'No completed kilometres in this period, so per-kilometre figures cannot be worked out and are shown as a dash rather than zero.'
            : undefined
        }
      >
        <Figures cols={2} className="panel panel-pad">
          <Figure label="Revenue per km" value={<Ratio value={summary.revenuePerKm} />} />
          <Figure label="Revenue per tonne" value={<Ratio value={summary.revenuePerTon} />} />
          <Figure label="Cost per km" value={<Ratio value={summary.costPerKm} />} />
          <Figure label="Cost per tonne" value={<Ratio value={summary.costPerTon} />} />
        </Figures>
      </Section>

      <Section id="v-fuel-economics" title="Fuel economics">
        <Figures cols={2} className="panel panel-pad">
          <Figure
            label="Diesel spend"
            value={<Money value={summary.fuelCost} />}
            sub={summary.expenses > 0 ? `${percent(summary.fuelCost / summary.expenses, 1)} of costs` : undefined}
          />
          <Figure label="Litres used" value={`${fmtNumber(summary.litres, 1)} L`} />
          <Figure
            label="Mileage"
            value={
              summary.mileage != null
                ? `${fmtNumber(summary.mileage, 2)} km/L`
                : <span className="unavailable" title="Two fuel fills are needed to measure mileage">—</span>
            }
          />
          <Figure label="Diesel per tonne carried" value={<Ratio value={safeDiv(summary.fuelCost, summary.tonnage)} />} />
        </Figures>
      </Section>
    </div>
  )
}
