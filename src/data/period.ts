/**
 * The period the whole product is looking at.
 *
 * The company sends a spreadsheet a month, so a month is the unit the owner
 * thinks in. Everything on screen answers for one period, chosen once, and a
 * custom range is available for the times a month is the wrong window.
 */

import { useCallback, useMemo, useState } from 'react'
import type { DateRange } from './calc'
import type { Database } from './types'
import { toISO } from './format'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export type PeriodMode = 'month' | 'custom' | 'all'

export interface Period {
  mode: PeriodMode
  /** `YYYY-MM` when the mode is `month`. */
  month: string
  range: DateRange
  label: string
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1].slice(0, 3)} ${String(y).slice(2)}`
}

export function monthRange(ym: string): DateRange {
  const [y, m] = ym.split('-').map(Number)
  return {
    from: toISO(new Date(y, m - 1, 1)),
    to: toISO(new Date(y, m, 0)),
    label: monthLabel(ym),
  }
}

export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function previousMonth(ym: string): string { return shiftMonth(ym, -1) }

/** Every month that has a record in it, newest first. */
export function monthsWithData(db: Database): string[] {
  const set = new Set<string>()
  for (const t of db.trips) set.add(monthKey(t.date))
  for (const f of db.fuel) set.add(monthKey(f.date))
  for (const e of db.expenses) set.add(monthKey(e.date))
  for (const m of db.maintenance) set.add(monthKey(m.date))
  for (const p of db.driverPayments) set.add(monthKey(p.date))
  return [...set].sort().reverse()
}

/** Where to land on first open: the most recent month that actually has data. */
export function defaultMonth(db: Database, today: string): string {
  return monthsWithData(db)[0] ?? monthKey(today)
}

export interface PeriodState extends Period {
  setMonth: (ym: string) => void
  step: (by: number) => void
  setCustom: (part: 'from' | 'to', value: string) => void
  useCustom: () => void
  useAll: () => void
  useMonth: (ym?: string) => void
}

export function usePeriod(db: Database, today: string): PeriodState {
  const [mode, setMode] = useState<PeriodMode>('month')
  const [month, setMonthRaw] = useState(() => defaultMonth(db, today))
  const [custom, setCustomRange] = useState(() => ({
    from: monthRange(defaultMonth(db, today)).from,
    to: today,
    label: 'Custom range',
  }))

  const range = useMemo<DateRange>(() => {
    if (mode === 'all') return { from: '1900-01-01', to: '2999-12-31', label: 'All time' }
    if (mode === 'custom') return custom
    return monthRange(month)
  }, [mode, month, custom])

  const label = mode === 'all' ? 'All time' : mode === 'custom' ? 'Custom range' : monthLabel(month)

  const setMonth = useCallback((ym: string) => { setMonthRaw(ym); setMode('month') }, [])
  const step = useCallback((by: number) => {
    setMode('month')
    setMonthRaw((prev) => shiftMonth(prev, by))
  }, [])
  const setCustom = useCallback((part: 'from' | 'to', value: string) => {
    if (!value) return
    setMode('custom')
    setCustomRange((prev) => {
      const next = { ...prev, [part]: value }
      // Keep the range the right way round however the user edits it.
      if (next.from > next.to) return part === 'from' ? { ...next, to: value } : { ...next, from: value }
      return next
    })
  }, [])

  return {
    mode, month, range, label,
    setMonth, step, setCustom,
    useCustom: useCallback(() => setMode('custom'), []),
    useAll: useCallback(() => setMode('all'), []),
    useMonth: useCallback((ym?: string) => { if (ym) setMonthRaw(ym); setMode('month') }, []),
  }
}
