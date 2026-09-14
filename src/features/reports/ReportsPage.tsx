/**
 * Reports.
 *
 * One period control, then the monthly business report — the thing that
 * actually gets sent to management — with the record-level exports beneath it
 * for anyone who wants the raw rows in a spreadsheet.
 */

import { useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { EmptyState, PageHeader, Section } from '../../ui/primitives'
import { PeriodBar } from '../../ui/PeriodBar'
import { useToast } from '../../ui/Toast'
import { useToday } from '../shared'
import { useDb } from '../../data/store'
import { useLedger } from '../../data/selectors'
import { buildReport, downloadCsv, REPORTS, type ReportId } from '../../data/reports'
import { buildMonthlyReport } from '../../data/monthlyReport'
import { monthRange, previousMonth, usePeriod } from '../../data/period'
import { number as fmtNumber } from '../../data/format'
import { DownloadIcon, FileIcon } from '../../ui/icons'
import { MonthlyReportView } from './MonthlyReportView'

const PREVIEW_ROWS = 20

export function ReportsPage() {
  const db = useDb()
  const ledger = useLedger()
  const today = useToday()
  const toast = useToast()
  const period = usePeriod(db, today)
  const [detail, setDetail] = useState<ReportId | null>(null)
  const [vehicleId, setVehicleId] = useState('')

  const previousRange = period.mode === 'month' ? monthRange(previousMonth(period.month)) : null

  const report = useMemo(
    () => buildMonthlyReport(db, ledger, period.range, period.label, previousRange),
    [db, ledger, period.range, period.label, previousRange],
  )

  const ctx = useMemo(
    () => ({ db, ledger, range: period.range, vehicleId: vehicleId || null, today }),
    [db, ledger, period.range, vehicleId, today],
  )

  const counts = useMemo(() => {
    const out = {} as Record<ReportId, number>
    for (const r of REPORTS) out[r.id] = buildReport(r.id, ctx).rows.length
    return out
  }, [ctx])

  const table = useMemo(() => (detail ? buildReport(detail, ctx) : null), [detail, ctx])

  const exportCsv = (id: ReportId) => {
    const t = buildReport(id, ctx)
    if (t.rows.length === 0) {
      toast.error('Nothing to export', 'No records fall inside the selected period.')
      return
    }
    downloadCsv(t)
    toast.success(`${t.title} exported`, `${fmtNumber(t.rows.length)} rows · ${t.filename}`)
  }

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Reports"
        actions={
          report.hasData && (
            <div className="report-actions row row-3">
              <Button icon={<DownloadIcon size={15} />} onClick={() => exportCsv('vehicles')}>
                Export CSV
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                Print / save as PDF
              </Button>
            </div>
          )
        }
      />

      <PeriodBar state={period} db={db} today={today} />

      {!report.hasData ? (
        <EmptyState
          icon={<FileIcon size={22} />}
          title={`Nothing to report for ${period.label}`}
          body="No trips, diesel or expenses fall in this period. Step to another month, or import the spreadsheet for it."
        />
      ) : (
        <MonthlyReportView report={report} />
      )}

      <Section
        id="exports"
        title="Record exports"
        note="Raw rows for Excel, Google Sheets or your accountant. Clean headers, unformatted numbers, no internal ids."
      >
        <div className="filters" style={{ marginBottom: 'var(--s-5)' }}>
          <label className="sr-only" htmlFor="export-vehicle">Vehicle</label>
          <select
            id="export-vehicle"
            className="select filter-select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">All vehicles</option>
            {db.vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name || v.registrationNumber}</option>
            ))}
          </select>
        </div>

        <div className="registry">
          {REPORTS.map((r) => (
            <div className="registry-row" key={r.id}>
              <span className="registry-identity">
                <span className="registry-name">{r.title}</span>
                <span className="registry-meta">{r.description}</span>
              </span>
              <span className="registry-metrics" style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                <span className="registry-metric">
                  <span className="registry-metric-label">Rows</span>
                  <span className="registry-metric-value">
                    {counts[r.id] > 0 ? fmtNumber(counts[r.id]) : <span className="t-muted">None</span>}
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() => setDetail(detail === r.id ? null : r.id)}
                  disabled={counts[r.id] === 0}
                >
                  {detail === r.id ? 'Hide' : 'View'}
                </Button>
                <Button
                  size="sm"
                  icon={<DownloadIcon size={13} />}
                  onClick={() => exportCsv(r.id)}
                  disabled={counts[r.id] === 0}
                >
                  CSV
                </Button>
              </span>
            </div>
          ))}
        </div>

        {table && table.rows.length > 0 && (
          <div className="stack stack-4">
            <div className="preview-wrap">
              <table className="table table-dense">
                <caption className="sr-only">{table.title} — preview of the exported file</caption>
                <thead>
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c.key} scope="col" className={c.numeric ? 'th-num' : undefined}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i}>
                      {table.columns.map((c) => {
                        const v = row[c.key]
                        return (
                          <td key={c.key} className={c.numeric ? 'td-num' : undefined}>
                            {v == null || v === ''
                              ? <span className="unavailable">—</span>
                              : c.numeric && typeof v === 'number'
                                ? fmtNumber(v, c.decimals ?? 0)
                                : String(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="t-micro t-muted">
              {table.rows.length > PREVIEW_ROWS
                ? `Previewing the first ${PREVIEW_ROWS} of ${fmtNumber(table.rows.length)} rows. The export has all of them.`
                : `All ${fmtNumber(table.rows.length)} rows shown.`}
              {' '}Saves as <span className="mono">{table.filename}</span>
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
