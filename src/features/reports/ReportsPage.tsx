/**
 * Reports — functional exports, not a second dashboard.
 *
 * The preview table and the CSV are generated from the same `ReportTable`, so
 * what is checked on screen is exactly what reaches the accountant. Files carry
 * a BOM, CRLF endings, RFC 4180 quoting and unformatted numbers, so Excel and
 * Google Sheets both open them correctly and SUM() works on the columns.
 */

import { useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { EmptyState, PageHeader, Section } from '../../ui/primitives'
import { RangeFilter, useRangeState } from '../../ui/RangeFilter'
import { useToast } from '../../ui/Toast'
import { useToday } from '../shared'
import { useDb } from '../../data/store'
import { useLedger } from '../../data/selectors'
import { buildReport, downloadCsv, REPORTS, type ReportId } from '../../data/reports'
import { number as fmtNumber } from '../../data/format'
import { DownloadIcon, FileIcon } from '../../ui/icons'

const PREVIEW_ROWS = 25

export function ReportsPage() {
  const db = useDb()
  const ledger = useLedger()
  const today = useToday()
  const toast = useToast()
  const rangeState = useRangeState(today, 'month')
  const [selected, setSelected] = useState<ReportId>('trips')
  const [vehicleId, setVehicleId] = useState<string>('')

  const ctx = useMemo(
    () => ({ db, ledger, range: rangeState.range, vehicleId: vehicleId || null, today }),
    [db, ledger, rangeState.range, vehicleId, today],
  )

  /* Row counts for every report, so the picker shows what each will contain
     before it is opened. */
  const counts = useMemo(() => {
    const out = {} as Record<ReportId, number>
    for (const r of REPORTS) out[r.id] = buildReport(r.id, ctx).rows.length
    return out
  }, [ctx])

  const table = useMemo(() => buildReport(selected, ctx), [selected, ctx])

  const exportCsv = () => {
    if (table.rows.length === 0) {
      toast.error('Nothing to export', 'No records fall inside the selected filters.')
      return
    }
    downloadCsv(table)
    toast.success(
      `${table.title} exported`,
      `${fmtNumber(table.rows.length)} rows saved as ${table.filename}`,
    )
  }

  const formatCell = (value: string | number | null, decimals?: number, numeric?: boolean) => {
    if (value == null || value === '') return <span className="unavailable">—</span>
    if (numeric && typeof value === 'number') {
      return <span className="num">{fmtNumber(value, decimals ?? 0)}</span>
    }
    return String(value)
  }

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Reports"
        subtitle="Export your records as CSV for Excel, Google Sheets or your accountant"
      />

      <Section
        id="r-filters"
        title="Filters"
        description="Applied to the preview and to the exported file alike."
      >
        <div className="filters">
          <RangeFilter state={rangeState} />
          <label className="sr-only" htmlFor="report-vehicle">Vehicle</label>
          <select
            id="report-vehicle"
            className="select filter-select"
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">All vehicles</option>
            {db.vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.registrationNumber}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section id="r-picker" title="Choose a report">
        <div className="report-grid">
          {REPORTS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`report-card${selected === r.id ? ' report-card-on' : ''}`}
              aria-pressed={selected === r.id}
              onClick={() => setSelected(r.id)}
            >
              <span className="report-card-title">{r.title}</span>
              <span className="report-card-body">{r.description}</span>
              <span className="report-card-count">
                {counts[r.id] === 0
                  ? 'No rows for these filters'
                  : `${fmtNumber(counts[r.id])} ${counts[r.id] === 1 ? 'row' : 'rows'}`}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        id="r-preview"
        title={table.title}
        description={table.description}
        actions={
          <Button
            variant="primary"
            icon={<DownloadIcon size={15} />}
            onClick={exportCsv}
            disabled={table.rows.length === 0}
          >
            Export CSV
          </Button>
        }
      >
        {table.rows.length === 0 ? (
          <EmptyState
            icon={<FileIcon size={20} />}
            title="No records match these filters"
            body="Widen the date range, or choose a different vehicle, and the report will fill in."
          />
        ) : (
          <div className="stack stack-5">
            <div className="preview-wrap">
              <table className="table table-dense">
                <caption className="sr-only">{table.title} — preview of the exported file</caption>
                <thead>
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c.key} scope="col" className={c.numeric ? 'th-num' : undefined}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i}>
                      {table.columns.map((c) => (
                        <td key={c.key} className={c.numeric ? 'td-num' : undefined}>
                          {formatCell(row[c.key], c.decimals, c.numeric)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {table.totals && (
                  <tfoot>
                    <tr>
                      {table.columns.map((c) => (
                        <td key={c.key} className={c.numeric ? 'td-num' : undefined}>
                          {table.totals![c.key] == null || table.totals![c.key] === ''
                            ? ''
                            : formatCell(table.totals![c.key], c.decimals, c.numeric)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="row row-between row-wrap" style={{ gap: 12 }}>
              <p className="t-micro t-muted">
                {table.rows.length > PREVIEW_ROWS
                  ? `Previewing the first ${PREVIEW_ROWS} of ${fmtNumber(table.rows.length)} rows. The export contains all of them.`
                  : `All ${fmtNumber(table.rows.length)} rows shown.`}
                {' '}Columns: {table.columns.length}.
              </p>
              <p className="t-micro t-muted">
                Saves as <span className="mono">{table.filename}</span>
              </p>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}
