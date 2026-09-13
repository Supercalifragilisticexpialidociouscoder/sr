/** Display pieces shared by more than one page. */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Money, type BadgeTone } from '../ui/primitives'
import {
  AlertCircleIcon, AlertTriangleIcon, FuelIcon, InfoIcon, ReceiptIcon,
  RouteIcon, WalletIcon, WrenchIcon,
} from '../ui/icons'
import { dateShort, moneyPrecise, todayISO } from '../data/format'
import type { Alert, Severity } from '../data/alerts'
import type { ActivityEvent, ActivityKind } from '../data/selectors'
import {
  TRIP_STATUS_LABEL, VEHICLE_STATUS_LABEL,
  type TripStatus, type VehicleStatus,
} from '../data/types'

/**
 * Chart colours for vehicles.
 *
 * Keyed to the vehicle's stable position in the fleet, never to its rank in
 * whatever is being charted — so re-sorting a chart, or filtering to a shorter
 * date range, never repaints the survivors. Past six vehicles the colour stops
 * carrying identity and the row label does the work alone.
 */
const SERIES = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)',
  'var(--series-4)', 'var(--series-5)', 'var(--series-6)',
]

export function vehicleColor(index: number): string {
  return index >= 0 && index < SERIES.length ? SERIES[index] : 'var(--series-1)'
}

/** `today` is read once per mount so a long-lived page cannot drift mid-session. */
export function useToday(): string {
  return useMemo(() => todayISO(), [])
}

/* ---------------------------------------------------------------- */
/* Status                                                            */
/* ---------------------------------------------------------------- */

const VEHICLE_TONE: Record<VehicleStatus, BadgeTone> = {
  active: 'positive', 'on-trip': 'info', maintenance: 'warning',
  idle: 'neutral', retired: 'neutral',
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <Badge tone={VEHICLE_TONE[status]} dot>{VEHICLE_STATUS_LABEL[status]}</Badge>
}

const TRIP_TONE: Record<TripStatus, BadgeTone> = {
  completed: 'positive', 'in-transit': 'info', cancelled: 'neutral',
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge tone={TRIP_TONE[status]}>{TRIP_STATUS_LABEL[status]}</Badge>
}

/* ---------------------------------------------------------------- */
/* Ratios                                                            */
/* ---------------------------------------------------------------- */

/**
 * Renders a per-unit figure, or an explicit dash when the denominator was
 * zero. The product never prints a confident zero for something it cannot know.
 */
export function Ratio({
  value, suffix, tone,
}: {
  value: number | null
  suffix?: string
  tone?: 'auto' | 'none'
}) {
  if (value == null) {
    return <span className="unavailable" title="No kilometres or tonnage recorded in this period">—</span>
  }
  const cls = tone === 'auto' ? (value < 0 ? 't-negative' : value > 0 ? 't-positive' : '') : ''
  return (
    <span className={`num ${cls}`}>
      {moneyPrecise(value)}
      {suffix && <span className="t-muted" style={{ fontWeight: 400 }}>{suffix}</span>}
    </span>
  )
}

/* ---------------------------------------------------------------- */
/* Alerts                                                            */
/* ---------------------------------------------------------------- */

const SEVERITY_ICON: Record<Severity, typeof AlertTriangleIcon> = {
  critical: AlertCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
}

export function AlertRow({ alert }: { alert: Alert }) {
  const Icon = SEVERITY_ICON[alert.severity]
  return (
    <li className={`alert alert-${alert.severity}`}>
      <span className="alert-icon"><Icon size={16} /></span>
      <div className="grow stack stack-2">
        <span className="alert-title">{alert.title}</span>
        <span className="alert-detail">{alert.detail}</span>
      </div>
      <Link to={alert.href} className="btn btn-secondary btn-sm alert-action">
        {alert.actionLabel}
      </Link>
    </li>
  )
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="stack stack-4">
      {alerts.map((a) => <AlertRow key={a.id} alert={a} />)}
    </ul>
  )
}

/* ---------------------------------------------------------------- */
/* Activity                                                          */
/* ---------------------------------------------------------------- */

const ACTIVITY_ICON: Record<ActivityKind, typeof RouteIcon> = {
  trip: RouteIcon,
  fuel: FuelIcon,
  expense: ReceiptIcon,
  maintenance: WrenchIcon,
  'driver-payment': WalletIcon,
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <ul className="feed">
      {events.map((e) => {
        const Icon = ACTIVITY_ICON[e.kind]
        return (
          <li className="feed-item" key={e.id}>
            <span className="feed-mark" aria-hidden="true"><Icon size={15} /></span>
            <span className="stack" style={{ gap: 1, minWidth: 0 }}>
              <span className="feed-title truncate">{e.title}</span>
              <span className="feed-meta truncate">{dateShort(e.date)} · {e.detail}</span>
            </span>
            <span className="feed-amount">
              {e.amount === 0
                ? <span className="unavailable">—</span>
                : <Money value={e.amount} polarity="auto" />}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
