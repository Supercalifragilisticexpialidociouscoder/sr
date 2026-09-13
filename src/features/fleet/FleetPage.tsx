/**
 * Fleet — the operational centre.
 *
 * Opens on the vehicle registry, because that is what the owner came to see.
 * Warnings sit above it only when there are any; fleet totals sit below the
 * heading so the business position is readable without scrolling.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, LinkButton } from '../../ui/Button'
import {
  EmptyState, Money, PageHeader, Plate, Section, Stat, Stats,
} from '../../ui/primitives'
import { RangeFilter, useRangeState } from '../../ui/RangeFilter'
import { AlertList, useToday, VehicleStatusBadge } from '../shared'
import { useForms } from '../forms/FormsProvider'
import { useAlerts } from '../../data/alerts'
import { useDb } from '../../data/store'
import { useFleetRows, useSummary } from '../../data/selectors'
import { km as formatKm, money, number as fmtNumber, tonnes } from '../../data/format'
import { VEHICLE_TYPE_LABEL } from '../../data/types'
import {
  ChevronRightIcon, PlusIcon, TruckIcon, UsersIcon,
} from '../../ui/icons'

const ALERTS_SHOWN = 3

export function FleetPage() {
  const db = useDb()
  const today = useToday()
  const navigate = useNavigate()
  const { openForm } = useForms()
  const rangeState = useRangeState(today, 'all')
  const rows = useFleetRows(rangeState.range)
  const alerts = useAlerts(today)
  const [allAlerts, setAllAlerts] = useState(false)

  /* Business-wide, not the sum of the vehicle rows. A cost that belongs to no
     single vehicle — a payment to an unassigned driver, say — is still a real
     cost, and summing the rows would quietly lose it. Analytics reads the same
     figure, so the two pages can never disagree. */
  const totals = useSummary(useMemo(
    () => ({ vehicleId: null, range: rangeState.range }),
    [rangeState.range],
  ))

  /* What the vehicle rows below do not account for, stated rather than hidden. */
  const unallocated = useMemo(
    () => totals.expenses - rows.reduce((a, r) => a + r.summary.expenses, 0),
    [totals.expenses, rows],
  )

  const visibleAlerts = allAlerts ? alerts : alerts.slice(0, ALERTS_SHOWN)
  const onRoad = db.vehicles.filter((v) => v.status === 'active' || v.status === 'on-trip').length

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Fleet"
        subtitle={
          db.vehicles.length === 0
            ? 'No vehicles registered yet'
            : `${db.vehicles.length} ${db.vehicles.length === 1 ? 'vehicle' : 'vehicles'} · ${onRoad} on the road · ${db.drivers.length} ${db.drivers.length === 1 ? 'driver' : 'drivers'}`
        }
        actions={
          <>
            <LinkButton to="/fleet/drivers" icon={<UsersIcon size={15} />}>Drivers</LinkButton>
            <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'vehicle' })}>
              Add vehicle
            </Button>
          </>
        }
      />

      {alerts.length > 0 && (
        <Section
          id="alerts"
          title="Needs attention"
          description={`${alerts.length} operational ${alerts.length === 1 ? 'warning' : 'warnings'}, most urgent first`}
          actions={
            alerts.length > ALERTS_SHOWN && (
              <Button size="sm" onClick={() => setAllAlerts((v) => !v)}>
                {allAlerts ? 'Show fewer' : `Show all ${alerts.length}`}
              </Button>
            )
          }
        >
          <AlertList alerts={visibleAlerts} />
        </Section>
      )}

      {db.vehicles.length > 0 && (
        <Section
          id="position"
          title="Fleet position"
          description="Every figure below is calculated from the trips, fuel and expenses you have logged."
          actions={<RangeFilter state={rangeState} compact />}
        >
          <Stats cols={6} colsMd={3} colsSm={2}>
            <Stat label="Revenue" value={<Money value={totals.grossIncome} />} />
            <Stat
              label="Expenses"
              value={<Money value={totals.expenses} />}
              sub={unallocated > 0 ? `${money(unallocated)} not tied to a vehicle` : undefined}
            />
            <Stat
              label="Net profit"
              value={<Money value={totals.netProfit} polarity="auto" />}
              sub={totals.margin != null ? `${(totals.margin * 100).toFixed(1)}% margin` : undefined}
            />
            <Stat label="Trips" value={<span className="num">{fmtNumber(totals.trips)}</span>} />
            <Stat label="Distance" value={<span className="num">{formatKm(totals.kilometres)}</span>} />
            <Stat label="Tonnage" value={<span className="num">{tonnes(totals.tonnage)}</span>} />
          </Stats>
        </Section>
      )}

      <Section
        id="registry"
        title="Vehicle registry"
        description={db.vehicles.length > 0 ? 'Select a vehicle to open its full operational profile.' : undefined}
      >
        {db.vehicles.length === 0 ? (
          <EmptyState
            icon={<TruckIcon size={20} />}
            title="No vehicles have been added yet"
            body="Add your first vehicle to start logging trips, diesel and expenses against it. Everything else in the system builds on the fleet."
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'vehicle' })}>
                Add vehicle
              </Button>
            }
          />
        ) : (
          <div className="registry">
            {rows.map(({ vehicle, driver, summary }) => (
              <button
                type="button"
                key={vehicle.id}
                className="registry-row"
                onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)}
                aria-label={`Open ${vehicle.name}, ${vehicle.registrationNumber}`}
              >
                <div className="registry-identity">
                  <span className="vmark" aria-hidden="true"><TruckIcon size={18} /></span>
                  <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                    <span className="row row-3 row-wrap">
                      <span className="registry-name">{vehicle.name}</span>
                      <Plate value={vehicle.registrationNumber} />
                    </span>
                    <span className="registry-meta">
                      <span>{VEHICLE_TYPE_LABEL[vehicle.type]}</span>
                      <span className="registry-meta-sep" aria-hidden="true">·</span>
                      <span className="truncate">{driver ? driver.name : 'No driver assigned'}</span>
                      <span className="registry-meta-sep" aria-hidden="true">·</span>
                      <span className="num">{fmtNumber(vehicle.odometer)} km</span>
                    </span>
                    <span className="row row-3" style={{ marginTop: 2 }}>
                      <VehicleStatusBadge status={vehicle.status} />
                    </span>
                  </span>
                </div>

                <div className="registry-metrics">
                  <span className="metric-inline">
                    <span className="metric-inline-label">Trips</span>
                    <span className="metric-inline-value">{fmtNumber(summary.trips)}</span>
                  </span>
                  <span className="metric-inline">
                    <span className="metric-inline-label">Distance</span>
                    <span className="metric-inline-value">{fmtNumber(summary.kilometres)} km</span>
                  </span>
                  <span className="metric-inline">
                    <span className="metric-inline-label">Revenue</span>
                    <span className="metric-inline-value"><Money value={summary.grossIncome} /></span>
                  </span>
                  <span className="metric-inline">
                    <span className="metric-inline-label">Expenses</span>
                    <span className="metric-inline-value"><Money value={summary.expenses} /></span>
                  </span>
                  <span className="metric-inline">
                    <span className="metric-inline-label">Profit</span>
                    <span className="metric-inline-value">
                      <Money value={summary.netProfit} polarity="auto" />
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      {db.vehicles.length > 0 && db.drivers.length === 0 && (
        <Section id="drivers-empty" title="Drivers">
          <EmptyState
            compact
            icon={<UsersIcon size={20} />}
            title="No drivers on record"
            body="Add drivers to assign them to vehicles, track licence renewals and keep a history of what each one has been paid."
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'driver' })}>
                Add driver
              </Button>
            }
          />
        </Section>
      )}

      {db.drivers.length > 0 && (
        <Link to="/fleet/drivers" className="panel panel-pad row row-between" style={{ gap: 16 }}>
          <span className="stack stack-2" style={{ minWidth: 0 }}>
            <span className="t-subhead">Drivers</span>
            <span className="t-micro t-muted">
              {db.drivers.length} on record · licences, assignments and payment history
            </span>
          </span>
          <ChevronRightIcon size={16} />
        </Link>
      )}
    </div>
  )
}
