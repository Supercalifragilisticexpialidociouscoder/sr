/**
 * Driver detail — the full financial relationship with one driver.
 *
 * The question it answers first is "how much money has this person had, and
 * how much is still owed?", so the account sits above the history.
 */

import { useMemo } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, IconButton } from '../../ui/Button'
import {
  Badge, EmptyState, Money, PageHeader, Plate, Section, Stat, Stats,
} from '../../ui/primitives'
import { DataTable, type Column } from '../../ui/DataTable'
import { useConfirm } from '../../ui/Confirm'
import { useToast } from '../../ui/Toast'
import { useForms } from '../forms/FormsProvider'
import { useToday } from '../shared'
import { useStore } from '../../data/store'
import { driverLedger, inRange, presetRange } from '../../data/calc'
import {
  date as formatDate, daysBetween, number as fmtNumber, relativeDays,
} from '../../data/format'
import {
  DRIVER_PAYMENT_LABEL, type DriverPayment, type DriverPaymentType, type Trip,
} from '../../data/types'
import {
  EditIcon, IdCardIcon, PhoneIcon, PlusIcon, TrashIcon, WalletIcon,
} from '../../ui/icons'
import type { Alert } from '../../data/alerts'

const TYPE_TONE: Record<DriverPaymentType, 'neutral' | 'warning' | 'accent' | 'info'> = {
  salary: 'accent', advance: 'warning', 'trip-payment': 'info', other: 'neutral',
}

export function DriverDetailPage() {
  const { driverId } = useParams()
  const { db, dispatch } = useStore()
  const today = useToday()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()

  const driver = db.drivers.find((d) => d.id === driverId)

  const payments = useMemo(
    () => db.driverPayments
      .filter((p) => p.driverId === driverId)
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.driverPayments, driverId],
  )

  const trips = useMemo(
    () => db.trips
      .filter((t) => t.driverId === driverId && t.status === 'completed')
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.trips, driverId],
  )

  const account = useMemo(
    () => driver ? driverLedger(payments, driver.salary, driver.joiningDate, today) : null,
    [payments, driver, today],
  )

  if (!driver || !account) return <Navigate to="/fleet/drivers" replace />

  const vehicle = db.vehicles.find((v) => v.id === driver.assignedVehicleId)
  const licenceDays = daysBetween(today, driver.licenseExpiry)

  const thisMonth = presetRange('month', today)
  const tripsThisMonth = trips.filter((t) => inRange(t.date, thisMonth))
  const freightEarned = trips.reduce((a, t) => a + t.freightAmount, 0)

  const licenceAlert: Alert | null = licenceDays < 0
    ? {
        id: 'lic', severity: 'critical',
        title: 'Licence has expired',
        detail: `Expired ${relativeDays(licenceDays)} on ${formatDate(driver.licenseExpiry)}. This driver must not be put on a trip until it is renewed.`,
        href: '#', actionLabel: '',
      }
    : licenceDays <= 45
      ? {
          id: 'lic', severity: 'warning',
          title: `Licence expires ${relativeDays(licenceDays)}`,
          detail: `Valid until ${formatDate(driver.licenseExpiry)}. Start the renewal at the RTO.`,
          href: '#', actionLabel: '',
        }
      : null

  const removePayment = async (payment: DriverPayment) => {
    const ok = await confirm({
      title: 'Delete this payment?',
      body: `₹${payment.amount.toLocaleString('en-IN')} recorded on ${formatDate(payment.date)} will be removed. ${driver.name}'s pending balance and the vehicle's driver costs will both be recalculated.`,
      confirmLabel: 'Delete payment',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'driverPayment/remove', id: payment.id })
    toast.success('Payment deleted')
  }

  const removeDriver = async () => {
    const ok = await confirm({
      title: `Remove ${driver.name}?`,
      body: `This deletes ${payments.length} payment ${payments.length === 1 ? 'record' : 'records'} as well. ${trips.length} ${trips.length === 1 ? 'trip' : 'trips'} will stay in the system but will no longer name a driver.`,
      confirmLabel: 'Remove driver',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'driver/remove', id: driver.id })
    toast.success(`${driver.name} removed`)
    navigate('/fleet/drivers')
  }

  const paymentColumns: Column<DriverPayment>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (p) => <span className="num t-secondary">{formatDate(p.date)}</span>,
    },
    {
      key: 'type', header: 'Type', mobile: 'title',
      render: (p) => <Badge tone={TYPE_TONE[p.type]}>{DRIVER_PAYMENT_LABEL[p.type]}</Badge>,
    },
    {
      key: 'notes', header: 'Notes', mobile: 'wide',
      render: (p) => p.notes
        ? <span className="t-secondary">{p.notes}</span>
        : <span className="t-muted">—</span>,
    },
    {
      key: 'amount', header: 'Amount', numeric: true, mobile: 'amount',
      render: (p) => <Money value={p.amount} className="td-strong" />,
    },
    {
      key: 'actions', header: '', numeric: true, width: '56px',
      render: (p) => (
        <IconButton label={`Delete payment of ₹${p.amount}`} size="sm" onClick={() => removePayment(p)}>
          <TrashIcon size={14} />
        </IconButton>
      ),
    },
  ]

  const tripColumns: Column<Trip>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (t) => <span className="num t-secondary">{formatDate(t.date)}</span>,
    },
    {
      key: 'route', header: 'Route', mobile: 'title',
      render: (t) => (
        <span className="stack" style={{ gap: 1, minWidth: 0 }}>
          <span className="td-strong truncate">{t.startLocation} → {t.destination}</span>
          <span className="t-micro t-muted mono">{t.reference}</span>
        </span>
      ),
    },
    {
      key: 'km', header: 'Distance', numeric: true,
      render: (t) => <span className="num">{fmtNumber(t.kilometres)} km</span>,
    },
    {
      key: 'tonnage', header: 'Load', numeric: true,
      render: (t) => <span className="num">{fmtNumber(t.tonnage, 1)} t</span>,
    },
    {
      key: 'freight', header: 'Freight', numeric: true, mobile: 'amount',
      render: (t) => <Money value={t.freightAmount} className="td-strong" />,
    },
  ]

  return (
    <div className="page stack stack-9">
      <PageHeader
        title={driver.name}
        back={{ to: '/fleet/drivers', label: 'Drivers' }}
        subtitle={
          <span className="row row-4 row-wrap">
            <span className="row row-3"><PhoneIcon size={13} />{driver.phone}</span>
            <span className="row row-3"><IdCardIcon size={13} /><span className="mono">{driver.licenseNumber}</span></span>
            {vehicle && <Plate value={vehicle.registrationNumber} />}
          </span>
        }
        actions={
          <>
            <Button icon={<EditIcon size={15} />} onClick={() => openForm({ kind: 'driver', edit: driver })}>
              Edit
            </Button>
            <Button
              variant="primary"
              icon={<PlusIcon size={15} />}
              onClick={() => openForm({ kind: 'driver-payment', driverId: driver.id })}
            >
              Record payment
            </Button>
          </>
        }
      />

      {licenceAlert && (
        <ul className="stack stack-4">
          <li className={`alert alert-${licenceAlert.severity}`}>
            <span className="alert-icon"><IdCardIcon size={16} /></span>
            <div className="grow stack stack-2">
              <span className="alert-title">{licenceAlert.title}</span>
              <span className="alert-detail">{licenceAlert.detail}</span>
            </div>
            <Button size="sm" onClick={() => openForm({ kind: 'driver', edit: driver })}>
              Update licence
            </Button>
          </li>
        </ul>
      )}

      <Stats cols={4} colsMd={3} colsSm={2}>
        <Stat
          label="Pending amount"
          hero
          value={<Money value={Math.max(0, account.pending)} />}
          tone={account.pending > 0 ? 'negative' : 'none'}
          sub={
            account.pending > 0
              ? 'Earned salary less salary paid and advances'
              : account.pending < 0
                ? `₹${Math.abs(account.pending).toLocaleString('en-IN')} drawn in advance`
                : 'Fully settled'
          }
        />
        <Stat label="Total paid to date" value={<Money value={account.totalPaid} />} sub={`${payments.length} payments`} />
        <Stat label="Monthly salary" value={<Money value={driver.salary} />} sub={`${account.monthsOfService} months of service`} />
        <Stat
          label="Trips driven"
          value={<span className="num">{fmtNumber(trips.length)}</span>}
          sub={`${tripsThisMonth.length} this month`}
        />
      </Stats>

      <Section
        id="account"
        title="Payment account"
        description="Every rupee that has gone to this driver, and what is still outstanding."
      >
        <div className="statement">
          <div className="panel panel-pad">
            <p className="t-eyebrow" style={{ marginBottom: 12 }}>Paid out</p>
            <div className="ledger">
              <div className="ledger-line">
                <span className="ledger-label">Salary paid</span>
                <span className="ledger-value"><Money value={account.salaryPaid} /></span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Advances given</span>
                <span className="ledger-value"><Money value={account.advances} /></span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Trip payments (batta)</span>
                <span className="ledger-value"><Money value={account.tripPayments} /></span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Other payments</span>
                <span className="ledger-value"><Money value={account.otherPayments} /></span>
              </div>
              <div className="ledger-line ledger-total">
                <span className="ledger-label">Total paid</span>
                <span className="ledger-value"><Money value={account.totalPaid} /></span>
              </div>
            </div>
          </div>

          <div className="panel panel-pad">
            <p className="t-eyebrow" style={{ marginBottom: 12 }}>Position</p>
            <div className="ledger">
              <div className="ledger-line">
                <span className="ledger-label">Joined</span>
                <span className="ledger-value">{formatDate(driver.joiningDate)}</span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Salary accrued from</span>
                <span className="ledger-value">{formatDate(account.accrualFrom)}</span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Salary earned ({account.monthsOfService} months)</span>
                <span className="ledger-value"><Money value={account.salaryEarned} /></span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Less: salary paid</span>
                <span className="ledger-value">−<Money value={account.salaryPaid} /></span>
              </div>
              <div className="ledger-line">
                <span className="ledger-label">Less: advances drawn</span>
                <span className="ledger-value">−<Money value={account.advances} /></span>
              </div>
              <div className="ledger-line ledger-total">
                <span className="ledger-label">
                  {account.pending >= 0 ? 'Pending to driver' : 'Advanced to driver'}
                </span>
                <span className="ledger-value">
                  <Money
                    value={Math.abs(account.pending)}
                    className={account.pending > 0 ? 't-warning' : ''}
                  />
                </span>
              </div>
            </div>
            <p className="t-micro t-muted" style={{ marginTop: 14, lineHeight: 1.6 }}>
              Only salary and advances settle against salary — batta is an
              allowance paid in full for each trip, not money drawn in advance.
              Accrual starts when payment records begin, so an experienced driver
              does not arrive carrying a balance that was settled before you
              started keeping records here.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="payments"
        title="Payment history"
        description={`${payments.length} ${payments.length === 1 ? 'record' : 'records'}`}
        actions={
          <Button size="sm" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'driver-payment', driverId: driver.id })}>
            Record payment
          </Button>
        }
      >
        {payments.length === 0 ? (
          <EmptyState
            compact
            icon={<WalletIcon size={20} />}
            title="No payments recorded yet"
            body={`Salary, advances and trip payments to ${driver.name} will appear here as you record them.`}
            action={
              <Button variant="primary" onClick={() => openForm({ kind: 'driver-payment', driverId: driver.id })}>
                Record first payment
              </Button>
            }
          />
        ) : (
          <DataTable
            rows={payments}
            columns={paymentColumns}
            getKey={(p) => p.id}
            dense
            caption={`Payment history for ${driver.name}`}
          />
        )}
      </Section>

      <Section
        id="driver-trips"
        title="Trips driven"
        description={trips.length > 0 ? `${fmtNumber(trips.length)} completed · ₹${freightEarned.toLocaleString('en-IN')} of freight brought in` : undefined}
      >
        {trips.length === 0 ? (
          <EmptyState compact title="No completed trips yet" body={`Trips assigned to ${driver.name} will be listed here.`} />
        ) : (
          <DataTable
            rows={trips.slice(0, 10)}
            columns={tripColumns}
            getKey={(t) => t.id}
            dense
            caption={`Recent trips driven by ${driver.name}`}
          />
        )}
        {trips.length > 10 && (
          <p className="t-micro t-muted">Showing the 10 most recent of {fmtNumber(trips.length)} trips.</p>
        )}
      </Section>

      {driver.notes && (
        <Section id="driver-notes" title="Notes">
          <p className="t-meta t-secondary" style={{ lineHeight: 1.7 }}>{driver.notes}</p>
        </Section>
      )}

      <Section id="driver-manage" title="Manage">
        <div className="row row-4 row-wrap">
          <Button variant="danger" icon={<TrashIcon size={15} />} onClick={removeDriver}>
            Remove driver
          </Button>
          <p className="t-micro t-muted" style={{ maxWidth: '48ch' }}>
            Removing a driver deletes their payment history. Trips they drove stay in the system.
          </p>
        </div>
      </Section>
    </div>
  )
}
