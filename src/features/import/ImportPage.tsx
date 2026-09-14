/**
 * Import — the way data actually gets into this product.
 *
 * A guided run of five steps: drop the file, let it be read, check what was
 * understood, import, done. The review step is the point of the whole screen —
 * it shows which column became which field and what could not be read, so the
 * owner can trust the figures that follow rather than take them on faith.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { EmptyState, Figure, Figures, PageHeader, Section } from '../../ui/primitives'
import { useToast } from '../../ui/Toast'
import { useConfirm } from '../../ui/Confirm'
import { useStore, newId } from '../../data/store'
import { readWorkbook, workbookSignature, WorkbookError } from '../../data/excel/read'
import {
  analyseSheets, build, remapForKind, type RawSheet, type SheetPlan, type BuildResult,
} from '../../data/excel/plan'
import { SHEET_SCHEMAS } from '../../data/excel/fields'
import { monthLabel, monthsWithData } from '../../data/period'
import { date as formatDate, number as fmtNumber, percent } from '../../data/format'
import type { ImportBatch, SheetKind } from '../../data/types'
import {
  AlertTriangleIcon, CheckIcon, ChevronRightIcon, FileIcon, InboxIcon, TrashIcon,
} from '../../ui/icons'

type Step = 'upload' | 'reading' | 'review' | 'done'

const KIND_LABEL: Record<SheetKind, string> = {
  trips: 'Trips', fuel: 'Diesel', adblue: 'AdBlue', expenses: 'Expenses',
  maintenance: 'Maintenance', vehicles: 'Vehicles', drivers: 'Drivers',
  'driver-payments': 'Driver payments', unknown: 'Not recognised',
}

const STEPS: { id: Step; label: string }[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'reading', label: 'Understanding' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Ready' },
]

export function ImportPage() {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [raw, setRaw] = useState<RawSheet[]>([])
  const [plans, setPlans] = useState<SheetPlan[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [done, setDone] = useState<{ batch: ImportBatch; months: string[] } | null>(null)

  /* The build is derived from the plans, so correcting a mapping updates the
     review instantly rather than needing the file to be uploaded again. */
  const result: BuildResult | null = useMemo(
    () => (plans.length ? build(db, plans, 'preview', { allowDuplicates: !skipDuplicates }) : null),
    [db, plans, skipDuplicates],
  )

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setFileName(file.name)
    setStep('reading')
    try {
      const sheets = await readWorkbook(file)
      const analysed = analyseSheets(sheets)
      setRaw(sheets)
      setPlans(analysed)
      setStep('review')
    } catch (err) {
      setError(err instanceof WorkbookError ? err.message : 'That file could not be read.')
      setStep('upload')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }, [handleFile])

  const setKind = (name: string, kind: SheetKind) => {
    setPlans((prev) => prev.map((p) => (p.name === name ? remapForKind(p, kind) : p)))
  }

  const setColumn = (name: string, column: number, fieldId: string) => {
    setPlans((prev) => prev.map((p) => {
      if (p.name !== name) return p
      const mapping = { ...p.mapping }
      // A field belongs to one column at a time, so claiming it releases the old one.
      for (const [c, f] of Object.entries(mapping)) {
        if (f === fieldId && Number(c) !== column) delete mapping[Number(c)]
      }
      if (fieldId) mapping[column] = fieldId
      else delete mapping[column]
      return { ...p, mapping }
    }))
  }

  const counts = useMemo(() => {
    if (!result) return null
    return {
      Trips: result.trips.length,
      Diesel: result.fuel.filter((f) => f.product === 'diesel').length,
      AdBlue: result.fuel.filter((f) => f.product === 'adblue').length,
      Expenses: result.expenses.length,
      Maintenance: result.maintenance.length,
      'Driver payments': result.driverPayments.length,
      Vehicles: result.newVehicles.length,
      Drivers: result.newDrivers.length,
    }
  }, [result])

  const totalRows = plans.reduce((a, p) => a + p.bodyRows.length, 0)
  const totalRecords = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  const mappedShare = totalRows > 0
    ? Math.min(1, (totalRecords + (result?.duplicates ?? 0)) / totalRows)
    : 0

  const commit = () => {
    if (!result) return
    const importId = newId()
    // Rebuild under the real id so every record carries its provenance.
    const final = build(db, plans, importId, { allowDuplicates: !skipDuplicates })
    const batch: ImportBatch = {
      id: importId,
      fileName,
      importedAt: new Date().toISOString(),
      signature: workbookSignature(raw, plans.map((p) => p.headerRow)),
      sheets: plans.map((p) => ({
        name: p.name,
        kind: p.kind,
        confidence: p.confidence,
        rowsRead: p.bodyRows.length,
        imported: final.perSheet[p.name]?.imported ?? 0,
        skipped: final.perSheet[p.name]?.skipped ?? 0,
        duplicates: final.perSheet[p.name]?.duplicates ?? 0,
      })),
      counts: {
        trips: final.trips.length,
        fuel: final.fuel.length,
        expenses: final.expenses.length,
        maintenance: final.maintenance.length,
        driverPayments: final.driverPayments.length,
        vehicles: final.newVehicles.length,
        drivers: final.newDrivers.length,
      },
      issues: final.issues,
    }

    dispatch({
      type: 'import/commit',
      batch,
      result: {
        vehicles: final.newVehicles,
        drivers: final.newDrivers,
        trips: final.trips,
        fuel: final.fuel,
        expenses: final.expenses,
        maintenance: final.maintenance,
        driverPayments: final.driverPayments,
      },
    })

    const months = [...new Set([
      ...final.trips.map((t) => t.date.slice(0, 7)),
      ...final.fuel.map((f) => f.date.slice(0, 7)),
      ...final.expenses.map((e) => e.date.slice(0, 7)),
      ...final.maintenance.map((m) => m.date.slice(0, 7)),
    ])].sort()

    setDone({ batch, months })
    setStep('done')
    toast.success(`${fmtNumber(totalRecords)} records imported`, fileName)
  }

  const reset = () => {
    setStep('upload'); setPlans([]); setRaw([]); setFileName(''); setDone(null); setError(null)
  }

  const undo = async (batch: ImportBatch) => {
    const total = Object.values(batch.counts).reduce((a, b) => a + b, 0)
    const ok = await confirm({
      title: `Undo the import of ${batch.fileName}?`,
      body: `This removes the ${fmtNumber(total)} records that file brought in, and nothing else. Anything entered by hand, or from another file, stays.`,
      confirmLabel: 'Undo this import',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'import/undo', importId: batch.id })
    toast.success('Import undone')
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Import data"
        meta={<span>Read the spreadsheet your company sends and turn it into records</span>}
      />

      <div className="steps">
        {STEPS.map((s, i) => (
          <span key={s.id} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-sep" aria-hidden="true" />}
            <span className={`step${i === stepIndex ? ' step-on' : i < stepIndex ? ' step-done' : ''}`}>
              <span className="step-index" aria-hidden="true">{i < stepIndex ? <CheckIcon size={10} /> : i + 1}</span>
              {s.label}
            </span>
          </span>
        ))}
      </div>

      {/* ---------------- Step 1: upload ---------------- */}
      {step === 'upload' && (
        <div className="stack stack-8">
          <button
            type="button"
            className={`dropzone${dragging ? ' dropzone-over' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="dropzone-mark"><InboxIcon size={24} /></span>
            <span className="stack stack-3" style={{ alignItems: 'center' }}>
              <span className="dropzone-title">Drop your company Excel file here</span>
              <span className="dropzone-body">
                Or select a file. The sheets are read as they are — the columns do not
                have to be in any particular order, and they do not have to be named
                the same way as last month.
              </span>
            </span>
            <span className="btn btn-primary">Choose a file</span>
            <span className="t-micro t-muted">.xlsx and .xlsm</span>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Choose an Excel file to import"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }}
          />

          {error && (
            <div className="alerts">
              <div className="alert alert-critical">
                <span className="alert-icon"><AlertTriangleIcon size={15} /></span>
                <span className="stack stack-2">
                  <span className="alert-title">That file could not be read</span>
                  <span className="alert-detail">{error}</span>
                </span>
              </div>
            </div>
          )}

          {db.imports.length > 0 && (
            <Section id="history" title="Previous imports" count={db.imports.length}>
              <div className="registry">
                {db.imports.map((batch) => (
                  <div className="registry-row" key={batch.id}>
                    <span className="registry-identity">
                      <span className="registry-name">{batch.fileName}</span>
                      <span className="registry-meta">
                        <span>{formatDate(batch.importedAt.slice(0, 10))}</span>
                        <span className="registry-meta-sep" aria-hidden="true">·</span>
                        <span>{batch.sheets.filter((s) => s.kind !== 'unknown').length} sheets</span>
                        {batch.issues.length > 0 && (
                          <>
                            <span className="registry-meta-sep" aria-hidden="true">·</span>
                            <span className="t-warning">{batch.issues.length} skipped</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="registry-metrics">
                      {Object.entries(batch.counts).filter(([, n]) => n > 0).slice(0, 4).map(([k, n]) => (
                        <span className="registry-metric" key={k}>
                          <span className="registry-metric-label">{k}</span>
                          <span className="registry-metric-value">{fmtNumber(n)}</span>
                        </span>
                      ))}
                      <span className="registry-metric" style={{ alignItems: 'flex-end' }}>
                        <Button size="sm" variant="ghost" icon={<TrashIcon size={13} />} onClick={() => undo(batch)}>
                          Undo
                        </Button>
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* ---------------- Step 2: reading ---------------- */}
      {step === 'reading' && (
        <div className="dropzone" style={{ cursor: 'default' }}>
          <span className="dropzone-mark"><FileIcon size={24} /></span>
          <span className="stack stack-3" style={{ alignItems: 'center' }}>
            <span className="dropzone-title">Understanding your data…</span>
            <span className="dropzone-body">Reading {fileName}</span>
          </span>
        </div>
      )}

      {/* ---------------- Step 3: review ---------------- */}
      {step === 'review' && result && counts && (
        <div className="stack stack-9">
          <Section id="found" title="What we found" count={fileName}>
            <div className="confidence">
              <span className="stack stack-2">
                <span className="confidence-figure">{fmtNumber(totalRecords)}</span>
                <span className="t-label">Records ready</span>
              </span>
              <span className="section-rule" aria-hidden="true" />
              <Figures cols={2} className="grow">
                <Figure label="Rows read" value={fmtNumber(totalRows)} />
                <Figure label="Understood" value={percent(mappedShare, 1)} />
                <Figure
                  label="Need attention"
                  value={result.issues.length > 0
                    ? <span className="t-warning">{fmtNumber(result.issues.length)}</span>
                    : <span className="t-muted">None</span>}
                />
                <Figure
                  label="Probable duplicates"
                  value={result.duplicates > 0
                    ? <span className="t-warning">{fmtNumber(result.duplicates)}</span>
                    : <span className="t-muted">None</span>}
                />
              </Figures>
            </div>
          </Section>

          <Section id="records" title="Records">
            <Figures cols={4} className="panel panel-pad">
              {Object.entries(counts).map(([label, n]) => (
                <Figure key={label} label={label} value={n > 0 ? fmtNumber(n) : <span className="t-muted">—</span>} />
              ))}
            </Figures>
          </Section>

          <Section
            id="sheets"
            title="Sheets"
            count={plans.length}
            note="Change what a sheet is, or which column became which field, and the counts above update as you go."
          >
            <div className="stack stack-5">
              {plans.map((plan) => {
                const schema = SHEET_SCHEMAS.find((s) => s.kind === plan.kind)
                const tally = result.perSheet[plan.name]
                return (
                  <div className="sheet-card" key={plan.name}>
                    <div className="sheet-head">
                      <span className="stack stack-2 grow" style={{ minWidth: 0 }}>
                        <span className="sheet-name truncate">{plan.name}</span>
                        <span className="t-micro t-muted">
                          {fmtNumber(plan.bodyRows.length)} rows
                          {plan.headerRow > 0 && ` · header on row ${plan.headerRow + 1}`}
                          {plan.kind !== 'unknown' && ` · ${Math.round(plan.confidence * 100)}% match`}
                          {tally && tally.skipped > 0 && ` · ${tally.skipped} skipped`}
                          {tally && tally.duplicates > 0 && ` · ${tally.duplicates} duplicate`}
                        </span>
                      </span>
                      <label className="sr-only" htmlFor={`kind-${plan.name}`}>What is in {plan.name}?</label>
                      <select
                        id={`kind-${plan.name}`}
                        className="select filter-select"
                        value={plan.kind}
                        onChange={(e) => setKind(plan.name, e.target.value as SheetKind)}
                      >
                        {SHEET_SCHEMAS.map((s) => (
                          <option key={s.kind} value={s.kind}>{KIND_LABEL[s.kind]}</option>
                        ))}
                        <option value="unknown">Skip this sheet</option>
                      </select>
                    </div>

                    {plan.kind !== 'unknown' && schema && (
                      <div className="sheet-body">
                        {plan.headers.map((header, column) => {
                          if (!header) return null
                          const sample = plan.samples[column]?.[0]
                          return (
                            <div className="maprow" key={column}>
                              <span className="maprow-source">
                                <span className="maprow-header truncate">{header}</span>
                                {sample && <span className="maprow-sample truncate">{sample}</span>}
                              </span>
                              <ChevronRightIcon size={13} className="maprow-arrow" />
                              <span>
                                <label className="sr-only" htmlFor={`map-${plan.name}-${column}`}>
                                  What is the column “{header}”?
                                </label>
                                <select
                                  id={`map-${plan.name}-${column}`}
                                  className="select"
                                  value={plan.mapping[column] ?? ''}
                                  onChange={(e) => setColumn(plan.name, column, e.target.value)}
                                >
                                  <option value="">Ignore this column</option>
                                  {schema.fields.map((f) => (
                                    <option key={f.id} value={f.id}>{f.label}</option>
                                  ))}
                                </select>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {result.issues.length > 0 && (
            <Section id="issues" title="Needs attention" count={result.issues.length}
              note="These rows will be skipped. Everything else still imports.">
              <div className="panel panel-pad">
                {result.issues.slice(0, 25).map((issue, i) => (
                  <div className="issue-row" key={i}>
                    <span className="issue-where">{issue.sheet} · row {issue.row}</span>
                    <span className="stack stack-2" style={{ minWidth: 0 }}>
                      <span className="issue-what">{issue.problem}</span>
                      <span className="issue-values truncate">
                        {issue.values.filter((v) => v != null && v !== '').join('  ·  ') || '(empty row)'}
                      </span>
                    </span>
                  </div>
                ))}
                {result.issues.length > 25 && (
                  <p className="t-micro t-muted" style={{ paddingTop: 12 }}>
                    and {fmtNumber(result.issues.length - 25)} more.
                  </p>
                )}
              </div>
            </Section>
          )}

          {result.duplicates > 0 && (
            <Section id="duplicates" title="Probable duplicates" count={result.duplicates}>
              <div className="panel panel-pad stack stack-5">
                <p className="section-note">
                  {fmtNumber(result.duplicates)} rows match records already held — same date,
                  same vehicle and same amount. This usually means part of this file has
                  been imported before.
                </p>
                <div className="choice-group">
                  <label className={`choice${skipDuplicates ? ' choice-on' : ''}`}>
                    <input type="radio" name="dupes" className="sr-only"
                      checked={skipDuplicates} onChange={() => setSkipDuplicates(true)} />
                    Skip duplicates
                  </label>
                  <label className={`choice${!skipDuplicates ? ' choice-on' : ''}`}>
                    <input type="radio" name="dupes" className="sr-only"
                      checked={!skipDuplicates} onChange={() => setSkipDuplicates(false)} />
                    Import them anyway
                  </label>
                </div>
                {!skipDuplicates && (
                  <p className="section-note t-warning">
                    Importing them again will double-count those amounts in every total.
                  </p>
                )}
              </div>
            </Section>
          )}

          <div className="row row-4 row-wrap">
            <Button variant="primary" onClick={commit} disabled={totalRecords === 0}>
              Import {fmtNumber(totalRecords)} records
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ---------------- Step 4: done ---------------- */}
      {step === 'done' && done && (
        <div className="stack stack-8">
          <EmptyState
            icon={<CheckIcon size={22} />}
            title={
              done.months.length === 1
                ? `${monthLabel(done.months[0])} is ready`
                : `${done.months.length} months are ready`
            }
            body={
              done.months.length > 1
                ? `${monthLabel(done.months[0])} to ${monthLabel(done.months[done.months.length - 1])} have been added. Every total, chart and report has been recalculated.`
                : 'Every total, chart and report has been recalculated.'
            }
            action={
              <div className="row row-4 row-wrap">
                <Button variant="primary" onClick={() => navigate('/reports')}>View monthly report</Button>
                <Button onClick={() => navigate('/')}>Open the overview</Button>
                <Button variant="ghost" onClick={reset}>Import another file</Button>
              </div>
            }
          />

          <Section id="summary" title="Imported">
            <Figures cols={4} className="panel panel-pad">
              {Object.entries(done.batch.counts).filter(([, n]) => n > 0).map(([label, n]) => (
                <Figure key={label} label={label} value={fmtNumber(n)} />
              ))}
            </Figures>
          </Section>

          {monthsWithData(db).length > 0 && (
            <p className="section-note">
              Months held: {monthsWithData(db).map(monthLabel).join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
