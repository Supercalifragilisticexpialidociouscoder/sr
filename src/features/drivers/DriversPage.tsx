/**
 * Drivers — part of the fleet, not a section of their own.
 *
 * Answers two questions at a glance: whose paperwork needs attention, and how
 * much money is outstanding to each of them.
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '../../ui/Button'
import { Badge, EmptyState, Money, PageHeader, Section, Stat, Stats } from '../../ui/primitives'
import { DataTable, type Column } from '../../ui/DataTable'
import { useForms } from '../forms/FormsProvider'
import { useToday } from '../shared'
import { useDb } from '../../data/store'
import { useDriverRows, type DriverRow } from '../../data/selectors'
import { presetRange } from '../../data/calc'
import { date as formatDate, daysBetween, initials, number as fmtNumber } from '../../data/format'
import { PlusIcon, UsersIcon } from '../../ui/icons'

function LicenceCell({ expiry, today }: { expiry: string; today: string }) {
  const days = daysBetween(today, expiry)
  if (days < 0) return <Badge tone="negative" dot>Expired {formatDate(expiry)}</Badge>
  if (days <= 45) return <Badge tone="warning" dot>{days} days left</Badge>
  return <span className="t-secondary">{formatDate(expiry)}</span>
}

export function DriversPage() {
  const db = useDb()
  const today = useToday()
  const navigate = useNavigate()
  const { openForm } = useForms()

  // Duty figures cover the full history so the list reflects the whole
  // relationship, not an arbitrary window.
  const rows = useDriverRows(today, presetRange('all', today))

  const totalPending = rows.reduce((a, r) => a + Math.max(0, r.account.pending), 0)
  const totalPaid = rows.reduce((a, r) => a + r.account.totalPaid, 0)
  const expiring = rows.filter((r) => daysBetween(today, r.driver.licenseExpiry) <= 45).length

  const columns: Column<DriverRow>[] = [
    {
      key: 'name',
      header: 'Driver',
      mobile: 'title',
      render: (r) => (
        <span className="row row-4" style={{ minWidth: 0 }}>
          <span className="avatar" aria-hidden="true">{initials(r.driver.name)}</span>
          <span className="stack" style={{ gap: 1, minWidth: 0 }}>
            <span className="td-strong truncate">{r.driver.name}</span>
            <span className="t-micro t-muted truncate">{r.driver.phone}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'vehicle',
      header: 'Assigned vehicle',
      render: (r) => r.vehicle
        ? <span className="t-secondary">{r.vehicle.name}</span>
        : <span className="t-muted">Not assigned</span>,
    },
    {
      key: 'licence',
      header: 'Licence expiry',
      render: (r) => <LicenceCell expiry={r.driver.licenseExpiry} today={today} />,
    },
    {
      key: 'trips',
      header: 'Trips',
      numeric: true,
      render: (r) => <span className="num">{fmtNumber(r.trips)}</span>,
    },
    {
      key: 'km',
      header: 'Distance',
      numeric: true,
      render: (r) => <span className="num">{fmtNumber(r.kilometres)} km</span>,
    },
    {
      key: 'salary',
      header: 'Monthly salary',
      numeric: true,
      render: (r) => <Money value={r.driver.salary} />,
    },
    {
      key: 'paid',
      header: 'Total paid',
      numeric: true,
      render: (r) => <Money value={r.account.totalPaid} />,
    },
    {
      key: 'pending',
      header: 'Pending',
      numeric: true,
      mobile: 'amount',
      render: (r) => r.account.pending > 0
        ? <Money value={r.account.pending} className="t-warning" />
        : r.account.pending < 0
          ? <span className="t-micro t-muted">₹{Math.abs(r.account.pending).toLocaleString('en-IN')} advanced</span>
          : <span className="t-muted">Settled</span>,
    },
  ]

  return (
    <div className="page stack stack-9">
      <PageHeader
        title="Drivers"
        back={{ to: '/fleet', label: 'Fleet' }}
        subtitle={
          db.drivers.length === 0
            ? 'No drivers on record'
            : `${db.drivers.length} on record${expiring > 0 ? ` · ${expiring} licence ${expiring === 1 ? 'renewal' : 'renewals'} due` : ''}`
        }
        actions={
          <>
            {db.drivers.length > 0 && (
              <Button onClick={() => openForm({ kind: 'driver-payment' })}>Record payment</Button>
            )}
            <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'driver' })}>
              Add driver
            </Button>
          </>
        }
      />

      {db.drivers.length === 0 ? (
        <EmptyState
          icon={<UsersIcon size={20} />}
          title="No drivers have been added yet"
          body="Add a driver to assign them to a vehicle, keep track of licence renewals, and record every salary, advance and trip payment in one place."
          action={
            <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'driver' })}>
              Add driver
            </Button>
          }
        />
      ) : (
        <>
          <Stats cols={3} colsMd={3} colsSm={2}>
            <Stat label="Paid to drivers, all time" value={<Money value={totalPaid} />} />
            <Stat
              label="Currently pending"
              value={<Money value={totalPending} />}
              tone={totalPending > 0 ? 'negative' : 'none'}
              sub="Earned salary less everything paid out"
            />
            <Stat
              label="Licences needing renewal"
              value={<span className="num">{expiring}</span>}
              sub="Expired or within 45 days"
            />
          </Stats>

          <Section
            id="driver-list"
            title="Driver register"
            description="Select a driver to see their full payment history."
          >
            <DataTable
              rows={rows}
              columns={columns}
              getKey={(r) => r.driver.id}
              onRowClick={(r) => navigate(`/fleet/drivers/${r.driver.id}`)}
              caption="Drivers with assignment, licence status and payment position"
            />
          </Section>
        </>
      )}
    </div>
  )
}
