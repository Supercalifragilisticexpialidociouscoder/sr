/**
 * The monthly report, as a document.
 *
 * Not a screenshot of the dashboard: a structured report with an executive
 * summary, per-vehicle performance, an expense analysis, operational figures,
 * top performers and the observations the data supports. Printing it gives ink
 * on paper (see the print block in components.css), which is what "send it to
 * management" actually means.
 */

import { Money } from '../../ui/primitives'
import { Ratio } from '../shared'
import type { MonthlyReport } from '../../data/monthlyReport'
import { deltaTone } from '../../data/insights'
import {
  date as formatDate, km as formatKm, number as fmtNumber, percent, tonnes,
} from '../../data/format'
import { CATEGORY_LABEL } from '../../data/types'
import { ArrowDownRightIcon, ArrowUpRightIcon } from '../../ui/icons'

function Cell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="stack stack-3">
      <span className="t-label">{label}</span>
      <span className="t-display">{value}</span>
      {sub && <span className="t-micro t-muted">{sub}</span>}
    </div>
  )
}

export function MonthlyReportView({ report }: { report: MonthlyReport }) {
  const { summary, operations } = report

  return (
    <article className="report">
      <header className="report-head stack stack-4">
        <span className="report-org">Sri Ram Enterprises</span>
        <h2 className="report-title">{report.title}</h2>
        <span className="report-period">
          {report.periodLabel} · {formatDate(report.range.from)} to {formatDate(report.range.to)}
        </span>
      </header>

      {/* ---------------- Executive summary ---------------- */}
      <section className="report-section">
        <p className="report-section-label">Business summary</p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--s-8) var(--s-7)',
          }}
        >
          <Cell
            label="Revenue"
            value={<Money value={summary.grossIncome} />}
            sub={`${fmtNumber(summary.trips)} completed trips`}
          />
          <Cell label="Expenses" value={<Money value={summary.expenses} />} />
          <Cell
            label="Net profit"
            value={<Money value={summary.netProfit} polarity="auto" />}
            sub={summary.margin != null ? `${percent(summary.margin, 1)} margin` : undefined}
          />
          <Cell label="Kilometres" value={formatKm(summary.kilometres)} />
          <Cell label="Tonnage" value={tonnes(summary.tonnage)} />
          <Cell
            label="Revenue per trip"
            value={<Ratio value={operations.revenuePerTrip} />}
          />
          <Cell label="Cost per km" value={<Ratio value={operations.costPerKm} />} />
          <Cell label="Profit per km" value={<Ratio value={operations.profitPerKm} tone="auto" />} />
        </div>
      </section>

      {/* ---------------- Against last month ---------------- */}
      {report.deltas.length > 0 && report.previous && (
        <section className="report-section">
          <p className="report-section-label">Against the previous month</p>
          <div className="table-wrap">
            <table className="table table-dense">
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col" className="th-num">This period</th>
                  <th scope="col" className="th-num">Previous</th>
                  <th scope="col" className="th-num">Change</th>
                </tr>
              </thead>
              <tbody>
                {report.deltas.map((d) => {
                  const tone = deltaTone(d)
                  const Icon = (d.change ?? 0) > 0 ? ArrowUpRightIcon : ArrowDownRightIcon
                  return (
                    <tr key={d.key}>
                      <td className="td-strong">{d.label}</td>
                      <td className="td-num">{d.format(d.current)}</td>
                      <td className="td-num t-muted">{d.format(d.previous)}</td>
                      <td className="td-num">
                        {d.change == null ? (
                          <span className="t-muted">new</span>
                        ) : Math.abs(d.change) < 0.005 ? (
                          <span className="t-muted">level</span>
                        ) : (
                          <span className={`delta delta-${tone}`}>
                            <Icon size={11} />
                            {percent(Math.abs(d.change), 1)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------------- Fleet performance ---------------- */}
      <section className="report-section">
        <p className="report-section-label">Vehicle performance</p>
        <div className="table-wrap">
          <table className="table table-dense">
            <thead>
              <tr>
                <th scope="col">Vehicle</th>
                <th scope="col" className="th-num">Trips</th>
                <th scope="col" className="th-num">KM</th>
                <th scope="col" className="th-num">Tonnage</th>
                <th scope="col" className="th-num">Revenue</th>
                <th scope="col" className="th-num">Diesel</th>
                <th scope="col" className="th-num">AdBlue</th>
                <th scope="col" className="th-num">FASTag</th>
                <th scope="col" className="th-num">Driver</th>
                <th scope="col" className="th-num">Maintenance</th>
                <th scope="col" className="th-num">Other</th>
                <th scope="col" className="th-num">Expenses</th>
                <th scope="col" className="th-num">Profit</th>
                <th scope="col" className="th-num">Profit / km</th>
              </tr>
            </thead>
            <tbody>
              {report.vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="td-strong">
                    {v.name}
                    <span className="t-micro t-muted mono" style={{ display: 'block' }}>{v.registration}</span>
                  </td>
                  <td className="td-num">{fmtNumber(v.trips)}</td>
                  <td className="td-num">{fmtNumber(v.kilometres)}</td>
                  <td className="td-num">{fmtNumber(v.tonnage, 1)}</td>
                  <td className="td-num"><Money value={v.revenue} /></td>
                  <td className="td-num"><Money value={v.diesel} /></td>
                  <td className="td-num">{v.adblue > 0 ? <Money value={v.adblue} /> : <span className="t-muted">—</span>}</td>
                  <td className="td-num">{v.fastag > 0 ? <Money value={v.fastag} /> : <span className="t-muted">—</span>}</td>
                  <td className="td-num">{v.driver > 0 ? <Money value={v.driver} /> : <span className="t-muted">—</span>}</td>
                  <td className="td-num">{v.maintenance > 0 ? <Money value={v.maintenance} /> : <span className="t-muted">—</span>}</td>
                  <td className="td-num">{v.otherExpenses > 0 ? <Money value={v.otherExpenses} /> : <span className="t-muted">—</span>}</td>
                  <td className="td-num"><Money value={v.expenses} /></td>
                  <td className="td-num"><Money value={v.profit} polarity="auto" /></td>
                  <td className="td-num"><Ratio value={v.profitPerKm} tone="auto" /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Fleet</td>
                <td className="td-num">{fmtNumber(summary.trips)}</td>
                <td className="td-num">{fmtNumber(summary.kilometres)}</td>
                <td className="td-num">{fmtNumber(summary.tonnage, 1)}</td>
                <td className="td-num"><Money value={summary.grossIncome} /></td>
                <td className="td-num"><Money value={summary.byCategory.diesel} /></td>
                <td className="td-num"><Money value={summary.byCategory.adblue} /></td>
                <td className="td-num"><Money value={summary.byCategory.fastag} /></td>
                <td className="td-num"><Money value={summary.byCategory.driver} /></td>
                <td className="td-num">
                  <Money value={summary.byCategory.service + summary.byCategory.repairs
                    + summary.byCategory.parts + summary.byCategory.tyres + summary.byCategory.puncture} />
                </td>
                <td className="td-num">
                  <Money value={summary.byCategory.toll + summary.byCategory.insurance
                    + summary.byCategory.documents + summary.byCategory.other} />
                </td>
                <td className="td-num"><Money value={summary.expenses} /></td>
                <td className="td-num"><Money value={summary.netProfit} polarity="auto" /></td>
                <td className="td-num"><Ratio value={summary.profitPerKm} tone="auto" /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ---------------- Expense analysis ---------------- */}
      <section className="report-section">
        <p className="report-section-label">Expense analysis</p>
        <div className="figures figures-2">
          {report.expenses.map((e) => (
            <div className="fline" key={e.category}>
              <span className="fline-label">{CATEGORY_LABEL[e.category]}</span>
              <span className="fline-value">
                <span className="fline-sub">{percent(e.share, 1)}</span>
                <Money value={e.amount} />
              </span>
            </div>
          ))}
          <div className="fline fline-total">
            <span className="fline-label">Total expenses</span>
            <span className="fline-value"><Money value={summary.expenses} /></span>
          </div>
        </div>
      </section>

      {/* ---------------- Operations ---------------- */}
      <section className="report-section">
        <p className="report-section-label">Operational performance</p>
        <div className="figures figures-2">
          <div className="fline">
            <span className="fline-label">Total trips</span>
            <span className="fline-value">{fmtNumber(operations.trips)}</span>
          </div>
          <div className="fline">
            <span className="fline-label">Average tonnage per trip</span>
            <span className="fline-value">{operations.tonnagePerTrip != null ? tonnes(operations.tonnagePerTrip) : <span className="unavailable">—</span>}</span>
          </div>
          <div className="fline">
            <span className="fline-label">Total kilometres</span>
            <span className="fline-value">{formatKm(operations.kilometres)}</span>
          </div>
          <div className="fline">
            <span className="fline-label">Average revenue per trip</span>
            <span className="fline-value"><Ratio value={operations.revenuePerTrip} /></span>
          </div>
          <div className="fline">
            <span className="fline-label">Total tonnage</span>
            <span className="fline-value">{tonnes(operations.tonnage)}</span>
          </div>
          <div className="fline">
            <span className="fline-label">Average revenue per tonne</span>
            <span className="fline-value"><Ratio value={operations.revenuePerTon} /></span>
          </div>
          <div className="fline">
            <span className="fline-label">Diesel</span>
            <span className="fline-value">
              <span className="fline-sub">{fmtNumber(summary.litres, 0)} L</span>
              <Money value={summary.fuelCost} />
            </span>
          </div>
          <div className="fline">
            <span className="fline-label">Mileage</span>
            <span className="fline-value">
              {summary.mileage != null
                ? `${fmtNumber(summary.mileage, 2)} km/L`
                : <span className="unavailable" title="Two diesel fills at different odometer readings are needed">—</span>}
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- Top performers ---------------- */}
      <section className="report-section">
        <p className="report-section-label">Top performers</p>
        <div className="figures figures-2">
          {report.topPerformers.map((t) => (
            <div className="fline" key={t.label}>
              <span className="fline-label">{t.label}</span>
              <span className="fline-value">
                {t.vehicle
                  ? <><span className="fline-sub">{t.vehicle}</span>{t.value}</>
                  : <span className="unavailable">—</span>}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Attention areas ---------------- */}
      {report.insights.length > 0 && (
        <section className="report-section">
          <p className="report-section-label">Attention areas</p>
          <div className="stack stack-5">
            {report.insights.map((i) => (
              <div className="stack stack-2" key={i.id}>
                <span className="t-meta" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {i.tone === 'warning' ? '▲ ' : i.tone === 'positive' ? '● ' : '– '}{i.title}
                </span>
                {i.detail && <span className="t-micro t-muted">{i.detail}</span>}
              </div>
            ))}
          </div>
          <p className="section-note" style={{ marginTop: 'var(--s-6)' }}>
            Every observation above is taken from the records in this period. Where the
            data does not support a comparison, none is made.
          </p>
        </section>
      )}
    </article>
  )
}
