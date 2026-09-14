/**
 * Fleet — the operational centre.
 *
 * Opens on the position and the registry, because those are the two things an
 * owner checks first: is the business up, and what is each truck doing.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, LinkButton } from '../../ui/Button'
import { Badge, EmptyState, Money, PageHeader, Plate, Section } from '../../ui/primitives'
import { useRangeState } from '../../ui/RangeFilter'
import { AlertList, useToday, vehicleColor, VehicleStatusBadge } from '../shared'
import { useForms } from '../forms/FormsProvider'
import { useAlerts } from '../../data/alerts'
import { useDb } from '../../data/store'
import { useFleetRows } from '../../data/selectors'
import { km as formatKm, number as fmtNumber, phone } from '../../data/format'
import { VEHICLE_TYPE_LABEL } from '../../data/types'
import { ChevronRightIcon, PlusIcon, TruckIcon, UsersIcon } from '../../ui/icons'

const ALERTS_SHOWN = 4

export function FleetPage() {
  const db = useDb()
  const today = useToday()
  const navigate = useNavigate()
  const { openForm } = useForms()
  const rangeState = useRangeState(today, 'all')
  const rows = useFleetRows(rangeState.range)
  const alerts = useAlerts(today)
  const [allAlerts, setAllAlerts] = useState(false)

  const visibleAlerts = allAlerts ? alerts : alerts.slice(0, ALERTS_SHOWN)
  const onRoad = db.vehicles.filter((v) => v.status === 'active' || v.status === 'on-trip').length

  if (db.vehicles.length === 0) {
    return (
      <div className="page stack stack-9">
        <PageHeader title="Fleet" meta={<span>No vehicles registered</span>} />
        <EmptyState
          icon={<TruckIcon size={22} />}
          title="No vehicles yet"
          body="Add your first vehicle to start logging trips, diesel and expenses against it. Everything else in the system builds on the fleet."
          action={
            <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'vehicle' })}>
              Add vehicle
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Fleet"
        meta={
          <>
            <span>{db.vehicles.length} vehicles</span>
            <span className="registry-meta-sep">·</span>
            <span>{onRoad} on the road</span>
            <span className="registry-meta-sep">·</span>
            <span>{db.drivers.length} drivers</span>
          </>
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
          count={alerts.length}
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

      <Section id="registry" title="Vehicle registry" count={db.vehicles.length}>
        <div className="registry">
          {rows.map(({ vehicle, driver, summary }, index) => (
            <button
              type="button"
              key={vehicle.id}
              className="registry-row"
              style={{ ['--vehicle-color' as string]: vehicleColor(index) }}
              onClick={() => navigate(`/fleet/vehicles/${vehicle.id}`)}
              aria-label={`Open ${vehicle.name}, ${vehicle.registrationNumber}`}
            >
              <span className="registry-identity">
                <span className="row row-4 row-wrap">
                  <span className="registry-name">{vehicle.name}</span>
                  <Plate value={vehicle.registrationNumber} />
                </span>
                <span className="registry-meta">
                  <span>{VEHICLE_TYPE_LABEL[vehicle.type]}</span>
                  <span className="registry-meta-sep" aria-hidden="true">·</span>
                  <span className="truncate">{driver ? driver.name : 'No driver'}</span>
                  {vehicle.odometer > 0 && (
                    <>
                      <span className="registry-meta-sep" aria-hidden="true">·</span>
                      <span className="mono">{fmtNumber(vehicle.odometer)} km</span>
                    </>
                  )}
                </span>
                <span className="row row-3">
                  <VehicleStatusBadge status={vehicle.status} />
                </span>
              </span>

              <span className="registry-metrics">
                <span className="registry-metric">
                  <span className="registry-metric-label">Trips</span>
                  <span className="registry-metric-value">{fmtNumber(summary.trips)}</span>
                </span>
                <span className="registry-metric">
                  <span className="registry-metric-label">Distance</span>
                  <span className="registry-metric-value">{formatKm(summary.kilometres)}</span>
                </span>
                <span className="registry-metric">
                  <span className="registry-metric-label">Revenue</span>
                  <span className="registry-metric-value"><Money value={summary.grossIncome} /></span>
                </span>
                <span className="registry-metric">
                  <span className="registry-metric-label">Expenses</span>
                  <span className="registry-metric-value"><Money value={summary.expenses} /></span>
                </span>
                <span className="registry-metric">
                  <span className="registry-metric-label">Profit</span>
                  <span className="registry-metric-value">
                    <Money value={summary.netProfit} polarity="auto" />
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        id="drivers"
        title="Drivers"
        count={db.drivers.length}
        actions={
          db.drivers.length > 0
            ? <LinkButton to="/fleet/drivers" size="sm">Open drivers</LinkButton>
            : <Button size="sm" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'driver' })}>Add driver</Button>
        }
      >
        {db.drivers.length === 0 ? (
          <EmptyState
            compact
            icon={<UsersIcon size={20} />}
            title="No drivers on record"
            body="Add drivers to assign them to vehicles and keep a history of everything they have been paid."
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'driver' })}>
                Add driver
              </Button>
            }
          />
        ) : (
          <div className="registry">
            {db.drivers.map((driver) => {
              const vehicle = db.vehicles.find((v) => v.id === driver.assignedVehicleId)
              const index = db.vehicles.findIndex((v) => v.id === driver.assignedVehicleId)
              return (
                <button
                  type="button"
                  key={driver.id}
                  className="registry-row"
                  style={{ ['--vehicle-color' as string]: index >= 0 ? vehicleColor(index) : 'transparent' }}
                  onClick={() => navigate(`/fleet/drivers/${driver.id}`)}
                  aria-label={`Open ${driver.name}`}
                >
                  <span className="registry-identity">
                    <span className="registry-name">{driver.name}</span>
                    <span className="registry-meta">
                      <span className="mono">{phone(driver.phone)}</span>
                      <span className="registry-meta-sep" aria-hidden="true">·</span>
                      <span className="mono">{driver.licenseNumber}</span>
                    </span>
                  </span>
                  <span className="registry-metrics">
                    <span className="registry-metric">
                      <span className="registry-metric-label">Vehicle</span>
                      <span className="registry-metric-value">{vehicle ? vehicle.name : '—'}</span>
                    </span>
                    <span className="registry-metric">
                      <span className="registry-metric-label">Salary</span>
                      <span className="registry-metric-value"><Money value={driver.salary} /></span>
                    </span>
                    <span className="registry-metric">
                      <span className="registry-metric-label">Licence</span>
                      <span className="registry-metric-value">
                        {driver.licenseExpiry
                          ? <Badge tone="neutral">{driver.licenseExpiry}</Badge>
                          : <span className="t-muted">Not recorded</span>}
                      </span>
                    </span>
                    <span className="registry-metric" style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <ChevronRightIcon size={15} />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
