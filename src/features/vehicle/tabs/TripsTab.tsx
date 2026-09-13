import { Button, IconButton } from '../../../ui/Button'
import { EmptyState, Money, Section, Stat, Stats } from '../../../ui/primitives'
import { DataTable, type Column } from '../../../ui/DataTable'
import { useConfirm } from '../../../ui/Confirm'
import { useToast } from '../../../ui/Toast'
import { useForms } from '../../forms/FormsProvider'
import { Ratio, TripStatusBadge } from '../../shared'
import { useStore } from '../../../data/store'
import { safeDiv } from '../../../data/calc'
import { date as formatDate, money, number as fmtNumber } from '../../../data/format'
import type { Trip } from '../../../data/types'
import { EditIcon, PlusIcon, RouteIcon, TrashIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

export function TripsTab({ vehicle, records, summary }: TabProps) {
  const { dispatch } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()

  const trips = records.trips
  const avgRate = safeDiv(summary.tripRevenue, summary.tonnage)

  const remove = async (trip: Trip) => {
    const ok = await confirm({
      title: `Delete trip ${trip.reference}?`,
      body: `${trip.startLocation} to ${trip.destination} on ${formatDate(trip.date)}. ${trip.status === 'completed' ? `${money(trip.freightAmount)} of revenue, ${fmtNumber(trip.kilometres)} km and ${trip.tonnage} t will come off this vehicle and the fleet totals.` : 'This trip does not currently count towards revenue.'}`,
      confirmLabel: 'Delete trip',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'trip/remove', id: trip.id })
    toast.success(`Trip ${trip.reference} deleted`)
  }

  const columns: Column<Trip>[] = [
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
      key: 'km', header: 'Kilometres', numeric: true,
      render: (t) => <span className="num">{fmtNumber(t.kilometres)}</span>,
    },
    {
      key: 'tonnage', header: 'Tonnage', numeric: true,
      render: (t) => <span className="num">{fmtNumber(t.tonnage, 1)} t</span>,
    },
    {
      key: 'rate', header: 'Rate / tonne', numeric: true,
      render: (t) => <Money value={t.pricePerTon} />,
    },
    {
      key: 'freight', header: 'Freight', numeric: true, mobile: 'amount',
      render: (t) => (
        <span className="stack" style={{ gap: 1, alignItems: 'flex-end' }}>
          <Money value={t.freightAmount} className="td-strong" />
          {t.freightOverride && <span className="t-micro t-muted">overridden</span>}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (t) => <TripStatusBadge status={t.status} />,
    },
    {
      key: 'actions', header: '', numeric: true, width: '92px',
      render: (t) => (
        <span className="row row-2 row-end">
          <IconButton label={`Edit trip ${t.reference}`} size="sm" onClick={() => openForm({ kind: 'trip', edit: t })}>
            <EditIcon size={14} />
          </IconButton>
          <IconButton label={`Delete trip ${t.reference}`} size="sm" onClick={() => remove(t)}>
            <TrashIcon size={14} />
          </IconButton>
        </span>
      ),
    },
  ]

  return (
    <div className="stack stack-8">
      <Section
        id="v-trips"
        title="Trips / Workout"
        description="Freight on every trip is tonnage × rate per tonne, unless it was deliberately overridden."
        actions={
          <Button size="sm" variant="primary" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'trip', vehicleId: vehicle.id })}>
            Log trip
          </Button>
        }
      >
        {trips.length === 0 ? (
          <EmptyState
            icon={<RouteIcon size={20} />}
            title="No trips in this period"
            body={`Log a trip against ${vehicle.name} and its revenue, kilometres and tonnage will flow straight into this vehicle's financials, the fleet totals and the reports.`}
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'trip', vehicleId: vehicle.id })}>
                Log trip
              </Button>
            }
          />
        ) : (
          <>
            <Stats cols={5} colsMd={3} colsSm={2}>
              <Stat
                label="Completed trips"
                value={<span className="num">{fmtNumber(summary.trips)}</span>}
                sub={summary.cancelledTrips > 0 ? `${summary.cancelledTrips} cancelled` : undefined}
              />
              <Stat label="Distance" value={<span className="num">{fmtNumber(summary.kilometres)} km</span>} />
              <Stat label="Tonnage" value={<span className="num">{fmtNumber(summary.tonnage, 1)} t</span>} />
              <Stat label="Freight earned" value={<Money value={summary.tripRevenue} />} />
              <Stat label="Average rate" value={<Ratio value={avgRate} suffix=" / t" />} />
            </Stats>
            <DataTable
              rows={trips}
              columns={columns}
              getKey={(t) => t.id}
              caption={`Trips for ${vehicle.name}`}
            />
          </>
        )}
      </Section>
    </div>
  )
}
