/**
 * One record list, two presentations.
 *
 * Above 768px it renders a real table, because that is the densest readable
 * form. Below it, the same rows become record cards — each column keeps its
 * label and its value. Nothing is hidden, clipped or shrunk to fit; the layout
 * changes instead.
 */

import { useEffect, useState, type ReactNode } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Right-aligns and tabularises the column in the table view. */
  numeric?: boolean
  /**
   * Where this column goes on a card:
   *  `title`  — the card's heading
   *  `amount` — the figure opposite the heading
   *  `meta`   — the line under the heading
   *  `field`  — a labelled cell in the card's field grid (the default)
   *  `wide`   — a labelled cell spanning the full card width
   */
  mobile?: 'title' | 'amount' | 'meta' | 'field' | 'wide'
  width?: string
}

export function DataTable<T>({
  rows, columns, getKey, onRowClick, dense = false, footer, caption,
}: {
  rows: T[]
  columns: Column<T>[]
  getKey: (row: T) => string
  onRowClick?: (row: T) => void
  dense?: boolean
  footer?: ReactNode
  caption?: string
}) {
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (isMobile) {
    const title = columns.find((c) => c.mobile === 'title') ?? columns[0]
    const amount = columns.find((c) => c.mobile === 'amount')
    const meta = columns.filter((c) => c.mobile === 'meta')
    const fields = columns.filter(
      (c) => c !== title && c !== amount && !meta.includes(c) && c.mobile !== 'title',
    )

    return (
      <div className="records">
        {caption && <span className="sr-only">{caption}</span>}
        {rows.map((row) => {
          const body = (
            <>
              <div className="record-head">
                <div className="record-head-main">
                  <span className="record-title">{title.render(row)}</span>
                  {meta.length > 0 && (
                    <span className="t-micro t-muted row row-3 row-wrap">
                      {meta.map((c) => <span key={c.key}>{c.render(row)}</span>)}
                    </span>
                  )}
                </div>
                {amount && <span className="record-amount">{amount.render(row)}</span>}
              </div>
              {fields.length > 0 && (
                <div className="record-fields">
                  {fields.map((c) => (
                    <div
                      key={c.key}
                      className={`record-field${c.mobile === 'wide' ? ' record-field-wide' : ''}`}
                    >
                      <span className="record-field-label">{c.header}</span>
                      <span className="record-field-value">{c.render(row)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )

          return onRowClick ? (
            <button
              type="button"
              key={getKey(row)}
              className="record record-tap"
              onClick={() => onRowClick(row)}
            >
              {body}
            </button>
          ) : (
            <div key={getKey(row)} className="record">{body}</div>
          )
        })}
        {footer}
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className={`table${onRowClick ? ' table-hover' : ''}${dense ? ' table-dense' : ''}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={c.numeric ? 'th-num' : undefined}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((c, i) => (
                <td key={c.key} className={c.numeric ? 'td-num' : undefined}>
                  {onRowClick && i === 0 ? (
                    // The first cell carries the keyboard affordance so the row
                    // is reachable without making the <tr> a fake button.
                    <button
                      type="button"
                      className="row-link"
                      onClick={(e) => { e.stopPropagation(); onRowClick(row) }}
                    >
                      {c.render(row)}
                    </button>
                  ) : (
                    c.render(row)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  )
}
