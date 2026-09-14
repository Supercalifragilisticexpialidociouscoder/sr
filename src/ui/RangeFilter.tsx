/**
 * Date-range control.
 *
 * Presets cover what an owner actually asks for; "Custom" reveals two date
 * inputs. The chosen range flows into every metric and chart on the page from
 * one piece of state, so nothing can be showing a different period.
 */

import { useCallback, useMemo, useState } from 'react'
import { presetRange, RANGE_PRESETS, type DateRange, type RangePreset } from '../data/calc'
import { date as formatDate } from '../data/format'

export interface RangeState {
  preset: RangePreset
  range: DateRange
  setPreset: (preset: RangePreset) => void
  setCustom: (part: 'from' | 'to', value: string) => void
}

export function useRangeState(today: string, initial: RangePreset = 'month'): RangeState {
  const [preset, setPresetRaw] = useState<RangePreset>(initial)
  const [custom, setCustomRange] = useState(() => presetRange('custom', today))

  const range = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset, today)),
    [preset, custom, today],
  )

  const setPreset = useCallback((next: RangePreset) => {
    // Entering Custom seeds the inputs from whatever was on screen, so the
    // page does not jump to an unrelated period.
    if (next === 'custom') setCustomRange((prev) => ({ ...prev, label: 'Custom range' }))
    setPresetRaw(next)
  }, [])

  const setCustom = useCallback((part: 'from' | 'to', value: string) => {
    if (!value) return
    setCustomRange((prev) => {
      const next = { ...prev, [part]: value }
      // Keep the range the right way round however the user edits it.
      if (next.from > next.to) {
        return part === 'from' ? { ...next, to: value } : { ...next, from: value }
      }
      return next
    })
  }, [])

  return { preset, range, setPreset, setCustom }
}

export function RangeFilter({ state, compact = false }: { state: RangeState; compact?: boolean }) {
  const { preset, range, setPreset, setCustom } = state
  return (
    <div className="filters">
      <label className="sr-only" htmlFor="range-preset">Date range</label>
      <select
        id="range-preset"
        className="select filter-select"
        value={preset}
        onChange={(e) => setPreset(e.target.value as RangePreset)}
      >
        {RANGE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {preset === 'custom' ? (
        <div className="filter-dates">
          <label className="sr-only" htmlFor="range-from">From date</label>
          <input
            id="range-from"
            type="date"
            className="input filter-date"
            value={range.from}
            max={range.to}
            onChange={(e) => setCustom('from', e.target.value)}
          />
          <span className="t-micro t-muted" aria-hidden="true">to</span>
          <label className="sr-only" htmlFor="range-to">To date</label>
          <input
            id="range-to"
            type="date"
            className="input filter-date"
            value={range.to}
            min={range.from}
            onChange={(e) => setCustom('to', e.target.value)}
          />
        </div>
      ) : (
        !compact && preset !== 'all' && (
          <span className="t-micro t-muted">
            {formatDate(range.from)} – {formatDate(range.to)}
          </span>
        )
      )}
    </div>
  )
}
