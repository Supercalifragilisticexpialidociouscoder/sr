import { Button } from '../../../ui/Button'
import { Badge, EmptyState, Money, Section } from '../../../ui/primitives'
import { ActivityFeed, Ratio } from '../../shared'
import { useForms } from '../../forms/FormsProvider'
import { useActivity, nextServiceFor } from '../../../data/selectors'
import { useDb } from '../../../data/store'
import { date as formatDate, daysBetween, number as fmtNumber, relativeDays } from '../../../data/format'
import { FUEL_TYPE_LABEL, VEHICLE_TYPE_LABEL } from '../../../data/types'
import { FuelIcon, InboxIcon, PlusIcon, ReceiptIcon, RouteIcon, WrenchIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

/** Colour-free first: the badge always carries a word, never just a hue. */
function ExpiryBadge({ expiry, today }: { expiry: string | undefined; today: string }) {
  if (!expiry) return <span className="t-muted">Not recorded</span>
  const days = daysBetween(today, expiry)
  if (days < 0) return <Badge tone="negative" dot>Expired {formatDate(expiry)}</Badge>
  if (days <= 30) return <Badge tone="warning" dot>Due {relativeDays(days)}</Badge>
  return <span className="t-secondary">{formatDate(expiry)}</span>
}

export function OverviewTab({ vehicle, summary, today }: TabProps) {
  const db = useDb()
  const { openForm } = useForms()
  const activity = useActivity(vehicle.id, 10)
  const service = nextServiceFor(db, vehicle.id)

  return (
    <div className="stack stack-9">
      <Section
        id="v-quick"
        title="Log against this vehicle"
        description="Each of these opens already set to this vehicle."
      >
        <div className="row row-4 row-wrap">
          <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'trip', vehicleId: vehicle.id })}>
            Log trip
          </Button>
          <Button icon={<FuelIcon size={15} />} onClick={() => openForm({ kind: 'fuel', vehicleId: vehicle.id })}>
            Add fuel
          </Button>
          <Button icon={<ReceiptIcon size={15} />} onClick={() => openForm({ kind: 'expense', vehicleId: vehicle.id })}>
            Add expense
          </Button>
          <Button icon={<WrenchIcon size={15} />} onClick={() => openForm({ kind: 'maintenance', vehicleId: vehicle.id })}>
            Add maintenance
          </Button>
        </div>
      </Section>

      <div className="statement">
        <Section id="v-specs" title="Specifications">
          <div className="ledger">
            <div className="ledger-line">
              <span className="ledger-label">Vehicle type</span>
              <span className="ledger-value">{VEHICLE_TYPE_LABEL[vehicle.type]}</span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Manufacturer and model</span>
              <span className="ledger-value">{vehicle.manufacturer || '—'} {vehicle.model}</span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Manufacturing year</span>
              <span className="ledger-value num">{vehicle.manufacturingYear}</span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Fuel type</span>
              <span className="ledger-value">{FUEL_TYPE_LABEL[vehicle.fuelType]}</span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Tank capacity</span>
              <span className="ledger-value num">
                {vehicle.tankCapacity > 0 ? `${fmtNumber(vehicle.tankCapacity)} L` : '—'}
              </span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Current odometer</span>
              <span className="ledger-value num">{fmtNumber(vehicle.odometer)} km</span>
            </div>
          </div>
        </Section>

        <Section id="v-docs" title="Documents and service">
          <div className="ledger">
            <div className="ledger-line">
              <span className="ledger-label">Insurance</span>
              <span className="ledger-value"><ExpiryBadge expiry={vehicle.insuranceExpiry} today={today} /></span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Permit</span>
              <span className="ledger-value"><ExpiryBadge expiry={vehicle.permitExpiry} today={today} /></span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Fitness certificate</span>
              <span className="ledger-value"><ExpiryBadge expiry={vehicle.fitnessExpiry} today={today} /></span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Next service due</span>
              <span className="ledger-value"><ExpiryBadge expiry={service?.nextServiceDue} today={today} /></span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Mileage</span>
              <span className="ledger-value">
                {summary.mileage != null
                  ? <span className="num">{fmtNumber(summary.mileage, 2)} km/L</span>
                  : <span className="unavailable" title="At least two fuel fills are needed to work out mileage">—</span>}
              </span>
            </div>
            <div className="ledger-line">
              <span className="ledger-label">Diesel cost per km</span>
              <span className="ledger-value"><Ratio value={summary.fuelCostPerKm} /></span>
            </div>
          </div>
        </Section>
      </div>

      <Section
        id="v-activity"
        title="Recent activity"
        description="Trips, diesel, expenses, maintenance and driver payments for this vehicle, newest first."
      >
        {activity.length === 0 ? (
          <EmptyState
            compact
            icon={<InboxIcon size={20} />}
            title="Nothing logged yet"
            body={`Trips, fuel and expenses recorded against ${vehicle.name} will appear here as they happen.`}
            action={
              <Button variant="primary" icon={<RouteIcon size={15} />} onClick={() => openForm({ kind: 'trip', vehicleId: vehicle.id })}>
                Log the first trip
              </Button>
            }
          />
        ) : (
          <ActivityFeed events={activity} />
        )}
      </Section>

      {vehicle.notes && (
        <Section id="v-notes" title="Notes">
          <p className="t-meta t-secondary" style={{ lineHeight: 1.7, maxWidth: '76ch' }}>{vehicle.notes}</p>
        </Section>
      )}

      {summary.trips === 0 && summary.expenses > 0 && (
        <p className="t-micro t-muted">
          This vehicle has costs but no completed trips in the selected period, so per-km and
          per-tonne figures cannot be worked out. They are shown as <Money value={null} /> rather than zero.
        </p>
      )}
    </div>
  )
}
