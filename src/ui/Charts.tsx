/**
 * Charts.
 *
 * Hand-built SVG rather than a charting library, so the marks obey the same
 * tokens as the rest of the product and nothing arrives pre-decorated.
 *
 * Conventions held across every chart here:
 *  - bars are capped at 24px and carry a 4px rounded data-end, square at the
 *    baseline; adjacent bars are separated by a 2px gap in the surface colour
 *  - gridlines are recessive hairlines; there is never a second y-axis
 *  - two or more series always carry a legend, so identity is never colour alone
 *  - every plot has a hover tooltip, and the numbers behind it are available as
 *    a table
 *  - a value that cannot be computed is omitted, never drawn as zero
 */

import {
  useCallback, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { moneyCompact, number as formatNumber } from '../data/format'

/* ---------------------------------------------------------------- */
/* Measuring                                                         */
/* ---------------------------------------------------------------- */

/** SVG text does not scale correctly inside a stretched viewBox, so charts are
 *  drawn at the container's real pixel width instead. */
function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (Math.abs(prev - next) > 0.5 ? next : prev))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

/* ---------------------------------------------------------------- */
/* Scales                                                            */
/* ---------------------------------------------------------------- */

function niceStep(rough: number): number {
  if (rough <= 0) return 1
  const exponent = Math.floor(Math.log10(rough))
  const base = Math.pow(10, exponent)
  const normalised = rough / base
  const snapped = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10
  return snapped * base
}

interface Scale {
  min: number
  max: number
  ticks: number[]
  /** Maps a value to a y pixel coordinate. */
  y: (value: number) => number
  zeroY: number
}

/** Builds a scale whose ticks land on round numbers and which always includes
 *  zero, so bar lengths stay proportional to their values. */
function buildScale(values: number[], height: number, targetTicks = 4): Scale {
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const span = rawMax - rawMin || 1
  const step = niceStep(span / targetTicks)
  const max = Math.ceil(rawMax / step) * step
  const min = Math.floor(rawMin / step) * step
  const domain = max - min || 1

  const ticks: number[] = []
  for (let t = min; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1e6) / 1e6)

  const y = (value: number) => height - ((value - min) / domain) * height
  return { min, max, ticks, y, zeroY: y(0) }
}

/* ---------------------------------------------------------------- */
/* Geometry                                                          */
/* ---------------------------------------------------------------- */

/** Column with a rounded data-end and a square baseline. `up` flips it for
 *  values below zero, so the rounding always sits at the far end. */
function columnPath(x: number, w: number, from: number, to: number, radius = 4): string {
  const top = Math.min(from, to)
  const bottom = Math.max(from, to)
  const h = bottom - top
  if (h <= 0.6) return ''
  const r = Math.max(0, Math.min(radius, w / 2, h))
  const up = to <= from
  if (up) {
    return `M${x},${bottom} L${x},${top + r} Q${x},${top} ${x + r},${top} `
      + `L${x + w - r},${top} Q${x + w},${top} ${x + w},${top + r} L${x + w},${bottom} Z`
  }
  return `M${x},${top} L${x},${bottom - r} Q${x},${bottom} ${x + r},${bottom} `
    + `L${x + w - r},${bottom} Q${x + w},${bottom} ${x + w},${bottom - r} L${x + w},${top} Z`
}

const MAX_BAR = 24
const BAR_GAP = 2

/* ---------------------------------------------------------------- */
/* Shared chrome                                                     */
/* ---------------------------------------------------------------- */

export interface LegendEntry { label: string; color: string }

export function Legend({ entries }: { entries: LegendEntry[] }) {
  if (entries.length < 2) return null
  return (
    <ul className="legend">
      {entries.map((e) => (
        <li className="legend-item" key={e.label}>
          <span className="legend-swatch" style={{ background: e.color }} aria-hidden="true" />
          {e.label}
        </li>
      ))}
    </ul>
  )
}

interface TipState { x: number; y: number; index: number }

function Tooltip({
  tip, width, children,
}: {
  tip: TipState
  width: number
  children: ReactNode
}) {
  const TIP_W = 190
  const left = Math.min(Math.max(tip.x - TIP_W / 2, 0), Math.max(0, width - TIP_W))
  return (
    <div className="chart-tip" style={{ left, top: Math.max(0, tip.y - 12), width: TIP_W }}>
      {children}
    </div>
  )
}

/** Thins x labels until they stop colliding, rather than shrinking the text. */
function labelStride(count: number, innerWidth: number, approxLabelWidth = 44): number {
  if (count === 0) return 1
  const fits = Math.max(1, Math.floor(innerWidth / approxLabelWidth))
  return Math.ceil(count / fits)
}

/* ---------------------------------------------------------------- */
/* Grouped columns — two measures over time                          */
/* ---------------------------------------------------------------- */

export interface SeriesSpec<T> {
  key: keyof T & string
  label: string
  color: string
}

export function GroupedColumns<T extends { label: string }>({
  data, series, height = 232, valueFormat = moneyCompact, ariaLabel,
}: {
  data: T[]
  series: SeriesSpec<T>[]
  height?: number
  valueFormat?: (v: number) => string
  ariaLabel: string
}) {
  const [ref, width] = useMeasure()
  const [tip, setTip] = useState<TipState | null>(null)

  const padding = { top: 12, right: 6, bottom: 26, left: 52 }
  const innerW = Math.max(0, width - padding.left - padding.right)
  const innerH = Math.max(0, height - padding.top - padding.bottom)

  const values = useMemo(
    () => data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0))),
    [data, series],
  )
  const scale = useMemo(() => buildScale(values, innerH), [values, innerH])

  const band = data.length > 0 ? innerW / data.length : 0
  const groupW = band * 0.7
  const barW = Math.min(MAX_BAR, Math.max(2, (groupW - BAR_GAP * (series.length - 1)) / series.length))
  const groupActual = barW * series.length + BAR_GAP * (series.length - 1)
  const stride = labelStride(data.length, innerW)

  const onMove = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (band === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const index = Math.min(data.length - 1, Math.max(0, Math.floor(x / band)))
    setTip({ x: padding.left + index * band + band / 2, y: 0, index })
  }, [band, data.length, padding.left])

  if (data.length === 0) return <ChartEmpty height={height} />

  const hovered = tip ? data[tip.index] : null

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${padding.left},${padding.top})`}>
            {scale.ticks.map((t) => (
              <g key={t}>
                <line className="chart-grid-line" x1={0} x2={innerW} y1={scale.y(t)} y2={scale.y(t)} />
                <text className="chart-tick" x={-10} y={scale.y(t)} dy="0.32em" textAnchor="end">
                  {valueFormat(t)}
                </text>
              </g>
            ))}
            <line className="chart-axis-line" x1={0} x2={innerW} y1={scale.zeroY} y2={scale.zeroY} />

            {data.map((d, i) => {
              const groupX = i * band + (band - groupActual) / 2
              return (
                <g key={d.label + i} opacity={tip && tip.index !== i ? 0.45 : 1}>
                  {series.map((s, si) => {
                    const value = Number(d[s.key] ?? 0)
                    return (
                      <path
                        key={s.key}
                        className="chart-bar"
                        d={columnPath(groupX + si * (barW + BAR_GAP), barW, scale.zeroY, scale.y(value))}
                        fill={s.color}
                      />
                    )
                  })}
                </g>
              )
            })}

            {data.map((d, i) =>
              i % stride === 0 ? (
                <text
                  key={`l-${d.label}-${i}`}
                  className="chart-tick"
                  x={i * band + band / 2}
                  y={innerH + 17}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null,
            )}

            <rect
              className="chart-hit"
              width={innerW}
              height={innerH}
              onPointerMove={onMove}
              onPointerLeave={() => setTip(null)}
            />
          </g>
        </svg>
      )}

      {tip && hovered && (
        <Tooltip tip={tip} width={width}>
          <div className="chart-tip-head">{hovered.label}</div>
          {series.map((s) => (
            <div className="chart-tip-row" key={s.key}>
              <span className="row row-3">
                <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </span>
              <b>{valueFormat(Number(hovered[s.key] ?? 0))}</b>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Diverging columns — one measure that can go negative              */
/* ---------------------------------------------------------------- */

export function DivergingColumns<T extends { label: string }>({
  data, valueKey, height = 210, valueFormat = moneyCompact, ariaLabel,
  positiveColor = 'var(--positive-mark)', negativeColor = 'var(--negative-mark)',
}: {
  data: T[]
  valueKey: keyof T & string
  height?: number
  valueFormat?: (v: number) => string
  ariaLabel: string
  positiveColor?: string
  negativeColor?: string
}) {
  const [ref, width] = useMeasure()
  const [tip, setTip] = useState<TipState | null>(null)

  const padding = { top: 12, right: 6, bottom: 26, left: 52 }
  const innerW = Math.max(0, width - padding.left - padding.right)
  const innerH = Math.max(0, height - padding.top - padding.bottom)

  const values = useMemo(() => data.map((d) => Number(d[valueKey] ?? 0)), [data, valueKey])
  const scale = useMemo(() => buildScale(values, innerH), [values, innerH])

  const band = data.length > 0 ? innerW / data.length : 0
  const barW = Math.min(MAX_BAR, Math.max(2, band * 0.62))
  const stride = labelStride(data.length, innerW)

  const onMove = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (band === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const index = Math.min(data.length - 1, Math.max(0, Math.floor((event.clientX - rect.left) / band)))
    setTip({ x: padding.left + index * band + band / 2, y: 0, index })
  }, [band, data.length, padding.left])

  if (data.length === 0) return <ChartEmpty height={height} />

  const hovered = tip ? data[tip.index] : null
  const hoveredValue = hovered ? Number(hovered[valueKey] ?? 0) : 0

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${padding.left},${padding.top})`}>
            {scale.ticks.map((t) => (
              <g key={t}>
                <line className="chart-grid-line" x1={0} x2={innerW} y1={scale.y(t)} y2={scale.y(t)} />
                <text className="chart-tick" x={-10} y={scale.y(t)} dy="0.32em" textAnchor="end">
                  {valueFormat(t)}
                </text>
              </g>
            ))}
            {/* The zero line is the second channel that carries the sign, so
                the green/red distinction never has to stand on hue alone. */}
            <line className="chart-axis-line" x1={0} x2={innerW} y1={scale.zeroY} y2={scale.zeroY} />

            {data.map((d, i) => {
              const value = Number(d[valueKey] ?? 0)
              return (
                <path
                  key={d.label + i}
                  className="chart-bar"
                  d={columnPath(i * band + (band - barW) / 2, barW, scale.zeroY, scale.y(value))}
                  fill={value < 0 ? negativeColor : positiveColor}
                  opacity={tip && tip.index !== i ? 0.45 : 1}
                />
              )
            })}

            {data.map((d, i) =>
              i % stride === 0 ? (
                <text
                  key={`l-${d.label}-${i}`}
                  className="chart-tick"
                  x={i * band + band / 2}
                  y={innerH + 17}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null,
            )}

            <rect
              className="chart-hit"
              width={innerW}
              height={innerH}
              onPointerMove={onMove}
              onPointerLeave={() => setTip(null)}
            />
          </g>
        </svg>
      )}

      {tip && hovered && (
        <Tooltip tip={tip} width={width}>
          <div className="chart-tip-head">{hovered.label}</div>
          <div className="chart-tip-row">
            <span>{hoveredValue < 0 ? 'Loss' : 'Profit'}</span>
            <b className={hoveredValue < 0 ? 't-negative' : 't-positive'}>{valueFormat(hoveredValue)}</b>
          </div>
        </Tooltip>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Single-series columns — compact, for counts                       */
/* ---------------------------------------------------------------- */

export function MiniColumns<T extends { label: string }>({
  data, valueKey, height = 150, color = 'var(--series-2)', valueFormat = (v: number) => formatNumber(v),
  ariaLabel,
}: {
  data: T[]
  valueKey: keyof T & string
  height?: number
  color?: string
  valueFormat?: (v: number) => string
  ariaLabel: string
}) {
  const [ref, width] = useMeasure()
  const [tip, setTip] = useState<TipState | null>(null)

  const padding = { top: 10, right: 4, bottom: 24, left: 40 }
  const innerW = Math.max(0, width - padding.left - padding.right)
  const innerH = Math.max(0, height - padding.top - padding.bottom)

  const values = useMemo(() => data.map((d) => Number(d[valueKey] ?? 0)), [data, valueKey])
  const scale = useMemo(() => buildScale(values, innerH, 3), [values, innerH])

  const band = data.length > 0 ? innerW / data.length : 0
  const barW = Math.min(MAX_BAR, Math.max(2, band * 0.6))
  const stride = labelStride(data.length, innerW, 40)

  const onMove = useCallback((event: React.PointerEvent<SVGRectElement>) => {
    if (band === 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const index = Math.min(data.length - 1, Math.max(0, Math.floor((event.clientX - rect.left) / band)))
    setTip({ x: padding.left + index * band + band / 2, y: 0, index })
  }, [band, data.length, padding.left])

  if (data.length === 0) return <ChartEmpty height={height} />

  const hovered = tip ? data[tip.index] : null

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${padding.left},${padding.top})`}>
            {scale.ticks.map((t) => (
              <g key={t}>
                <line className="chart-grid-line" x1={0} x2={innerW} y1={scale.y(t)} y2={scale.y(t)} />
                <text className="chart-tick" x={-8} y={scale.y(t)} dy="0.32em" textAnchor="end">
                  {valueFormat(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => (
              <path
                key={d.label + i}
                className="chart-bar"
                d={columnPath(i * band + (band - barW) / 2, barW, scale.zeroY, scale.y(Number(d[valueKey] ?? 0)))}
                fill={color}
                opacity={tip && tip.index !== i ? 0.45 : 1}
              />
            ))}
            {data.map((d, i) =>
              i % stride === 0 ? (
                <text
                  key={`l-${d.label}-${i}`}
                  className="chart-tick"
                  x={i * band + band / 2}
                  y={innerH + 16}
                  textAnchor="middle"
                >
                  {d.label}
                </text>
              ) : null,
            )}
            <rect
              className="chart-hit"
              width={innerW}
              height={innerH}
              onPointerMove={onMove}
              onPointerLeave={() => setTip(null)}
            />
          </g>
        </svg>
      )}
      {tip && hovered && (
        <Tooltip tip={tip} width={width}>
          <div className="chart-tip-head">{hovered.label}</div>
          <div className="chart-tip-row">
            <span>{ariaLabel}</span>
            <b>{valueFormat(Number(hovered[valueKey] ?? 0))}</b>
          </div>
        </Tooltip>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Bar list — ranked horizontal bars                                 */
/* ---------------------------------------------------------------- */

export interface BarListItem {
  id: string
  label: string
  value: number
  /** Shown at the end of the row; falls back to the formatted value. */
  display?: string
  color?: string
  meta?: string
}

/**
 * Horizontal ranked bars. Identity comes from the row label, so colour is
 * reinforcement rather than the only channel — which is what lets this form
 * carry more categories than a categorical palette safely could.
 */
export function BarList({
  items, format = moneyCompact, max,
}: {
  items: BarListItem[]
  format?: (v: number) => string
  max?: number
}) {
  const ceiling = max ?? Math.max(1, ...items.map((i) => Math.abs(i.value)))
  if (items.length === 0) return <ChartEmpty height={120} />
  return (
    <div className="barlist">
      {items.map((item) => {
        const pct = Math.min(100, (Math.abs(item.value) / ceiling) * 100)
        const negative = item.value < 0
        return (
          <div className="barlist-row" key={item.id}>
            <div className="barlist-head">
              <span className="barlist-name truncate">{item.label}</span>
              <span className={`barlist-value ${negative ? 't-negative' : ''}`}>
                {item.display ?? format(item.value)}
              </span>
            </div>
            <div
              className="barlist-track"
              role="meter"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${item.label}: ${item.display ?? format(item.value)}`}
            >
              <div
                className="barlist-fill"
                style={{
                  width: `${Math.max(pct, item.value === 0 ? 0 : 1.5)}%`,
                  background: item.color ?? (negative ? 'var(--negative-mark)' : 'var(--series-1)'),
                }}
              />
            </div>
            {item.meta && <span className="t-micro t-muted">{item.meta}</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      className="row"
      style={{ height, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--t-micro)' }}
    >
      No data in this period
    </div>
  )
}

/**
 * The table behind a chart.
 *
 * Every time series in the product can be read as numbers — the accessibility
 * requirement, and genuinely useful when someone wants the exact figure.
 */
export function SeriesTable<T extends { label: string }>({
  data, columns,
}: {
  data: T[]
  columns: { key: keyof T & string; label: string; format: (v: number) => string }[]
}) {
  return (
    <div className="table-wrap">
      <table className="table table-dense">
        <thead>
          <tr>
            <th scope="col">Period</th>
            {columns.map((c) => <th scope="col" className="th-num" key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.label + i}>
              <th scope="row" className="td-strong" style={{ textAlign: 'left', fontWeight: 500, padding: '8px 12px' }}>
                {row.label}
              </th>
              {columns.map((c) => (
                <td className="td-num" key={c.key}>{c.format(Number(row[c.key] ?? 0))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
