/**
 * The period control.
 *
 * One month at a time, stepped with the arrows, because that is the rhythm the
 * company's spreadsheets arrive on. Months that hold no records are still
 * reachable by stepping, but the dropdown lists the ones that do — so the
 * common case is one click.
 */

import { monthLabel, monthsWithData, shiftMonth, type PeriodState } from '../data/period'
import type { Database } from '../data/types'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { date as formatDate } from '../data/format'

export function PeriodBar({
  state, db, today,
}: {
  state: PeriodState
  db: Database
  today: string
}) {
  const months = monthsWithData(db)
  const currentMonthKey = today.slice(0, 7)
  // Always offer this month and the one on screen, even if they hold nothing yet.
  const options = [...new Set([...months, currentMonthKey, state.month])].sort().reverse()
  const atLatest = state.mode === 'month' && state.month >= options[0]

  return (
    <div className="period">
      <div className="period-stepper">
        <button
          type="button"
          className="period-step"
          onClick={() => state.step(-1)}
          aria-label={`Previous month, ${monthLabel(shiftMonth(state.month, -1))}`}
        >
          <ChevronLeftIcon size={15} />
        </button>

        <label className="sr-only" htmlFor="period-month">Month</label>
        <select
          id="period-month"
          className="period-current"
          value={state.mode === 'month' ? state.month : ''}
          onChange={(e) => state.setMonth(e.target.value)}
        >
          {state.mode !== 'month' && <option value="">{state.label}</option>}
          {options.map((ym) => (
            <option key={ym} value={ym}>
              {monthLabel(ym)}{months.includes(ym) ? '' : ' · no data'}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="period-step"
          onClick={() => state.step(1)}
          disabled={atLatest}
          aria-label={`Next month, ${monthLabel(shiftMonth(state.month, 1))}`}
        >
          <ChevronRightIcon size={15} />
        </button>
      </div>

      <div className="segment" role="group" aria-label="Period type">
        <button
          type="button"
          className={`segment-item${state.mode === 'month' ? ' segment-on' : ''}`}
          onClick={() => state.useMonth()}
        >
          Month
        </button>
        <button
          type="button"
          className={`segment-item${state.mode === 'all' ? ' segment-on' : ''}`}
          onClick={state.useAll}
        >
          All time
        </button>
        <button
          type="button"
          className={`segment-item${state.mode === 'custom' ? ' segment-on' : ''}`}
          onClick={state.useCustom}
        >
          Custom
        </button>
      </div>

      {state.mode === 'custom' && (
        <div className="filter-dates">
          <label className="sr-only" htmlFor="period-from">From</label>
          <input
            id="period-from" type="date" className="input filter-date"
            value={state.range.from} max={state.range.to}
            onChange={(e) => state.setCustom('from', e.target.value)}
          />
          <span className="t-micro t-muted" aria-hidden="true">to</span>
          <label className="sr-only" htmlFor="period-to">To</label>
          <input
            id="period-to" type="date" className="input filter-date"
            value={state.range.to} min={state.range.from}
            onChange={(e) => state.setCustom('to', e.target.value)}
          />
        </div>
      )}

      {state.mode === 'month' && (
        <span className="t-micro t-muted">
          {formatDate(state.range.from)} – {formatDate(state.range.to)}
        </span>
      )}
    </div>
  )
}
