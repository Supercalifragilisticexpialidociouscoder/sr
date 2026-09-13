import { useMemo } from 'react'
import { Button, IconButton } from '../../../ui/Button'
import { EmptyState, Money, Section, Stat, Stats } from '../../../ui/primitives'
import { DataTable, type Column } from '../../../ui/DataTable'
import { useConfirm } from '../../../ui/Confirm'
import { useToast } from '../../../ui/Toast'
import { useForms } from '../../forms/FormsProvider'
import { Ratio } from '../../shared'
import { useStore } from '../../../data/store'
import { safeDiv } from '../../../data/calc'
import {
  date as formatDate, litres as formatLitres, money, moneyPrecise, number as fmtNumber,
} from '../../../data/format'
import { PAYMENT_METHOD_LABEL, type FuelEntry } from '../../../data/types'
import { EditIcon, FuelIcon, PlusIcon, TrashIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

interface FuelRow extends FuelEntry {
  /** Distance since this vehicle's previous fill, or null for the first one. */
  distance: number | null
  mileage: number | null
}

export function FuelTab({ vehicle, records, summary }: TabProps) {
  const { dispatch } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()

  /* Per-fill mileage needs the previous reading, so the list is walked in
     chronological order before being shown newest-first. */
  const rows = useMemo<FuelRow[]>(() => {
    const ascending = [...records.fuel].sort((a, b) =>
      a.date === b.date ? a.odometer - b.odometer : a.date < b.date ? -1 : 1)
    let previous: number | null = null
    const withMileage = ascending.map((f) => {
      const distance = previous != null && f.odometer > previous ? f.odometer - previous : null
      previous = f.odometer
      return { ...f, distance, mileage: distance != null ? safeDiv(distance, f.litres) : null }
    })
    return withMileage.reverse()
  }, [records.fuel])

  const remove = async (entry: FuelEntry) => {
    const ok = await confirm({
      title: 'Delete this fuel entry?',
      body: `${formatLitres(entry.litres)} costing ${money(entry.totalAmount)} on ${formatDate(entry.date)}. This is ${vehicle.name}'s diesel expenditure, so its expenses, profit and cost per km will all change.`,
      confirmLabel: 'Delete entry',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'fuel/remove', id: entry.id })
    toast.success('Fuel entry deleted')
  }

  const columns: Column<FuelRow>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (f) => <span className="num t-secondary">{formatDate(f.date)}</span>,
    },
    {
      key: 'station', header: 'Fuel station', mobile: 'title',
      render: (f) => <span className="td-strong truncate">{f.fuelStation}</span>,
    },
    {
      key: 'litres', header: 'Litres', numeric: true,
      render: (f) => <span className="num">{fmtNumber(f.litres, 1)}</span>,
    },
    {
      key: 'rate', header: 'Rate / litre', numeric: true,
      render: (f) => <span className="num">{moneyPrecise(f.pricePerLitre)}</span>,
    },
    {
      key: 'amount', header: 'Amount', numeric: true, mobile: 'amount',
      render: (f) => <Money value={f.totalAmount} className="td-strong" />,
    },
    {
      key: 'odometer', header: 'Odometer', numeric: true,
      render: (f) => <span className="num">{fmtNumber(f.odometer)} km</span>,
    },
    {
      key: 'mileage', header: 'Mileage', numeric: true,
      render: (f) => f.mileage != null
        ? <span className="num">{fmtNumber(f.mileage, 2)} km/L</span>
        : <span className="unavailable" title="No earlier fill to measure against">—</span>,
    },
    {
      key: 'method', header: 'Paid by',
      render: (f) => <span className="t-secondary">{PAYMENT_METHOD_LABEL[f.paymentMethod]}</span>,
    },
    {
      key: 'actions', header: '', numeric: true, width: '92px',
      render: (f) => (
        <span className="row row-2 row-end">
          <IconButton label={`Edit fuel entry from ${formatDate(f.date)}`} size="sm" onClick={() => openForm({ kind: 'fuel', edit: f })}>
            <EditIcon size={14} />
          </IconButton>
          <IconButton label={`Delete fuel entry from ${formatDate(f.date)}`} size="sm" onClick={() => remove(f)}>
            <TrashIcon size={14} />
          </IconButton>
        </span>
      ),
    },
  ]

  return (
    <div className="stack stack-8">
      <Section
        id="v-fuel"
        title="Fuel"
        description="Diesel is recorded here only. These entries are the vehicle's diesel expenditure — they are never entered again as an expense."
        actions={
          <Button size="sm" variant="primary" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'fuel', vehicleId: vehicle.id })}>
            Add fuel
          </Button>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<FuelIcon size={20} />}
            title="No fuel recorded in this period"
            body={`Add a fill for ${vehicle.name} to start tracking diesel spend, mileage and cost per kilometre. Two or more fills are needed before mileage can be worked out.`}
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'fuel', vehicleId: vehicle.id })}>
                Add fuel
              </Button>
            }
          />
        ) : (
          <>
            <Stats cols={5} colsMd={3} colsSm={2}>
              <Stat label="Diesel spend" value={<Money value={summary.fuelCost} />} sub={`${rows.length} fills`} />
              <Stat label="Litres" value={<span className="num">{fmtNumber(summary.litres, 1)} L</span>} />
              <Stat
                label="Mileage"
                value={
                  summary.mileage != null
                    ? <span className="num">{fmtNumber(summary.mileage, 2)} km/L</span>
                    : <span className="unavailable">—</span>
                }
                sub={summary.mileage == null ? 'Needs two fills' : 'Tank to tank'}
              />
              <Stat label="Diesel per km" value={<Ratio value={summary.fuelCostPerKm} />} />
              <Stat label="Diesel per trip" value={<Ratio value={summary.fuelCostPerTrip} />} />
            </Stats>
            <DataTable
              rows={rows}
              columns={columns}
              getKey={(f) => f.id}
              caption={`Fuel entries for ${vehicle.name}`}
            />
          </>
        )}
      </Section>
    </div>
  )
}
