import { Link } from 'react-router-dom'
import { Button } from '../../../ui/Button'
import { Avatar, Badge, EmptyState, Money, Section } from '../../../ui/primitives'
import { DataTable, type Column } from '../../../ui/DataTable'
import { useForms } from '../../forms/FormsProvider'
import { useDb } from '../../../data/store'
import { driverLedger, inRange } from '../../../data/calc'
import {
  date as formatDate, daysBetween, initials, number as fmtNumber,
} from '../../../data/format'
import { DRIVER_PAYMENT_LABEL, type DriverPayment } from '../../../data/types'
import { ChevronRightIcon, PlusIcon, UsersIcon, WalletIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

export function DriversTab({ vehicle, records, range, today }: TabProps) {
  const db = useDb()
  const { openForm } = useForms()

  const assigned = db.drivers.filter((d) => d.assignedVehicleId === vehicle.id)

  // Anyone who has actually driven this vehicle in the period, assigned or not.
  const driverIds = new Set(records.trips.map((t) => t.driverId).filter(Boolean) as string[])
  for (const d of assigned) driverIds.add(d.id)
  const drivers = db.drivers.filter((d) => driverIds.has(d.id))

  const payments = db.driverPayments
    .filter((p) => driverIds.has(p.driverId) && inRange(p.date, range))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const paymentColumns: Column<DriverPayment>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (p) => <span className="num t-secondary">{formatDate(p.date)}</span>,
    },
    {
      key: 'driver', header: 'Driver', mobile: 'title',
      render: (p) => <span className="td-strong">{db.drivers.find((d) => d.id === p.driverId)?.name ?? '—'}</span>,
    },
    {
      key: 'type', header: 'Type',
      render: (p) => <Badge>{DRIVER_PAYMENT_LABEL[p.type]}</Badge>,
    },
    {
      key: 'notes', header: 'Notes', mobile: 'wide',
      render: (p) => p.notes ? <span className="t-secondary truncate">{p.notes}</span> : <span className="t-muted">—</span>,
    },
    {
      key: 'amount', header: 'Amount', numeric: true, mobile: 'amount',
      render: (p) => <Money value={p.amount} className="td-strong" />,
    },
  ]

  return (
    <div className="stack stack-9">
      <Section
        id="v-driver"
        title="Assigned driver"
        description="One driver holds a vehicle at a time. Assigning someone new releases the current driver."
        actions={
          <Button size="sm" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'driver', vehicleId: vehicle.id })}>
            {assigned.length > 0 ? 'Add another driver' : 'Assign a driver'}
          </Button>
        }
      >
        {assigned.length === 0 ? (
          <EmptyState
            compact
            icon={<UsersIcon size={20} />}
            title="No driver assigned to this vehicle"
            body="Assigning a driver means trips and fuel entries fill their name in automatically, and their salary and batta count towards this vehicle's costs."
            action={
              <Button variant="primary" onClick={() => openForm({ kind: 'driver', vehicleId: vehicle.id })}>
                Assign a driver
              </Button>
            }
          />
        ) : (
          <div className="registry">
            {assigned.map((driver) => {
              const account = driverLedger(
                db.driverPayments.filter((p) => p.driverId === driver.id),
                driver.salary, driver.joiningDate, today,
              )
              const licenceDays = daysBetween(today, driver.licenseExpiry)
              const driverTrips = records.trips.filter((t) => t.driverId === driver.id && t.status === 'completed')
              return (
                <Link key={driver.id} to={`/fleet/drivers/${driver.id}`} className="registry-row">
                  <div className="registry-identity">
                    <Avatar initials={initials(driver.name)} large />
                    <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                      <span className="registry-name">{driver.name}</span>
                      <span className="registry-meta">
                        <span>{driver.phone}</span>
                        <span className="registry-meta-sep" aria-hidden="true">·</span>
                        <span className="mono">{driver.licenseNumber}</span>
                      </span>
                      <span className="row row-3" style={{ marginTop: 2 }}>
                        {licenceDays < 0
                          ? <Badge tone="negative" dot>Licence expired</Badge>
                          : licenceDays <= 45
                            ? <Badge tone="warning" dot>Licence expires in {licenceDays} days</Badge>
                            : <Badge tone="positive" dot>Licence valid to {formatDate(driver.licenseExpiry)}</Badge>}
                      </span>
                    </span>
                  </div>
                  <div className="registry-metrics">
                    <span className="metric-inline">
                      <span className="metric-inline-label">Trips in period</span>
                      <span className="metric-inline-value">{fmtNumber(driverTrips.length)}</span>
                    </span>
                    <span className="metric-inline">
                      <span className="metric-inline-label">Monthly salary</span>
                      <span className="metric-inline-value"><Money value={driver.salary} /></span>
                    </span>
                    <span className="metric-inline">
                      <span className="metric-inline-label">Total paid</span>
                      <span className="metric-inline-value"><Money value={account.totalPaid} /></span>
                    </span>
                    <span className="metric-inline">
                      <span className="metric-inline-label">Pending</span>
                      <span className="metric-inline-value">
                        {account.pending > 0
                          ? <Money value={account.pending} className="t-warning" />
                          : <span className="t-muted">Settled</span>}
                      </span>
                    </span>
                    <span className="metric-inline" style={{ alignItems: 'flex-end' }}>
                      <ChevronRightIcon size={16} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Section>

      <Section
        id="v-driver-payments"
        title="Driver payments in this period"
        description="These count as driver costs on this vehicle's financials."
        actions={
          drivers.length > 0 && (
            <Button size="sm" icon={<WalletIcon size={14} />} onClick={() => openForm({ kind: 'driver-payment', driverId: assigned[0]?.id })}>
              Record payment
            </Button>
          )
        }
      >
        {payments.length === 0 ? (
          <EmptyState
            compact
            title="No driver payments in this period"
            body="Salary, advances and batta recorded for this vehicle's drivers will be listed here."
          />
        ) : (
          <DataTable
            rows={payments}
            columns={paymentColumns}
            getKey={(p) => p.id}
            dense
            caption={`Driver payments for ${vehicle.name}`}
          />
        )}
      </Section>
    </div>
  )
}
