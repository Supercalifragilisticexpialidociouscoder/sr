import { useMemo } from 'react'
import { Button, IconButton } from '../../../ui/Button'
import { Badge, EmptyState, Figure, Figures, Money, Section } from '../../../ui/primitives'
import { DataTable, type Column } from '../../../ui/DataTable'
import { useConfirm } from '../../../ui/Confirm'
import { useToast } from '../../../ui/Toast'
import { useForms } from '../../forms/FormsProvider'
import { useStore } from '../../../data/store'
import { nextServiceFor } from '../../../data/selectors'
import { safeDiv } from '../../../data/calc'
import {
  date as formatDate, daysBetween, money, number as fmtNumber, relativeDays,
} from '../../../data/format'
import { MAINTENANCE_TYPE_LABEL, type Maintenance } from '../../../data/types'
import { AlertTriangleIcon, EditIcon, PlusIcon, TrashIcon, WrenchIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

export function MaintenanceTab({ vehicle, records, summary, today }: TabProps) {
  const { db, dispatch } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()

  const rows = records.maintenance
  const service = nextServiceFor(db, vehicle.id)
  const serviceDays = service?.nextServiceDue ? daysBetween(today, service.nextServiceDue) : null

  const totals = useMemo(() => {
    const cost = rows.reduce((a, m) => a + m.cost, 0)
    return {
      cost,
      perKm: safeDiv(cost, summary.kilometres),
      lastService: rows.filter((m) => m.type === 'service' || m.type === 'oil-change')
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0],
    }
  }, [rows, summary.kilometres])

  const remove = async (record: Maintenance) => {
    const ok = await confirm({
      title: 'Delete this maintenance record?',
      body: `${MAINTENANCE_TYPE_LABEL[record.type]} costing ${money(record.cost)} on ${formatDate(record.date)}. It will come out of this vehicle's expenses and profit.`,
      confirmLabel: 'Delete record',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'maintenance/remove', id: record.id })
    toast.success('Maintenance record deleted')
  }

  const columns: Column<Maintenance>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (m) => <span className="num t-secondary">{formatDate(m.date)}</span>,
    },
    {
      key: 'description', header: 'Work carried out', mobile: 'title',
      render: (m) => <span className="td-strong truncate">{m.description}</span>,
    },
    {
      key: 'type', header: 'Type',
      render: (m) => <Badge>{MAINTENANCE_TYPE_LABEL[m.type]}</Badge>,
    },
    {
      key: 'odometer', header: 'Odometer', numeric: true,
      render: (m) => <span className="num">{fmtNumber(m.odometer)} km</span>,
    },
    {
      key: 'next', header: 'Next due',
      render: (m) => m.nextServiceDue
        ? <span className="t-secondary num">{formatDate(m.nextServiceDue)}</span>
        : <span className="t-muted">—</span>,
    },
    {
      key: 'cost', header: 'Cost', numeric: true, mobile: 'amount',
      render: (m) => <Money value={m.cost} className="td-strong" />,
    },
    {
      key: 'actions', header: '', numeric: true, width: '92px',
      render: (m) => (
        <span className="row row-2 row-end">
          <IconButton label={`Edit maintenance from ${formatDate(m.date)}`} size="sm" onClick={() => openForm({ kind: 'maintenance', edit: m })}>
            <EditIcon size={14} />
          </IconButton>
          <IconButton label={`Delete maintenance from ${formatDate(m.date)}`} size="sm" onClick={() => remove(m)}>
            <TrashIcon size={14} />
          </IconButton>
        </span>
      ),
    },
  ]

  return (
    <div className="stack stack-8">
      {serviceDays != null && serviceDays <= 14 && (
        <ul className="stack stack-4">
          <li className={`alert alert-${serviceDays < 0 ? 'critical' : 'warning'}`}>
            <span className="alert-icon"><AlertTriangleIcon size={16} /></span>
            <div className="grow stack stack-2">
              <span className="alert-title">
                {serviceDays < 0
                  ? `Service overdue by ${Math.abs(serviceDays)} days`
                  : `Service due ${relativeDays(serviceDays)}`}
              </span>
              <span className="alert-detail">
                Scheduled for {formatDate(service!.nextServiceDue!)}, last attended at{' '}
                {fmtNumber(service!.odometer)} km. The vehicle is now at {fmtNumber(vehicle.odometer)} km.
              </span>
            </div>
            <Button size="sm" onClick={() => openForm({ kind: 'maintenance', vehicleId: vehicle.id })}>
              Record service
            </Button>
          </li>
        </ul>
      )}

      <Section
        id="v-maintenance"
        title="Maintenance"
        actions={
          <Button size="sm" variant="primary" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'maintenance', vehicleId: vehicle.id })}>
            Add maintenance
          </Button>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<WrenchIcon size={20} />}
            title="No maintenance recorded in this period"
            body={`Log services, tyres, punctures and repairs for ${vehicle.name} to build a maintenance history and get warned before the next service falls due.`}
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'maintenance', vehicleId: vehicle.id })}>
                Add maintenance
              </Button>
            }
          />
        ) : (
          <>
            <Figures cols={2} className="panel panel-pad">
              <Figure label="Maintenance spend" value={<Money value={totals.cost} />} sub={`${rows.length} records`} />
              <Figure
                label="Per kilometre"
                value={totals.perKm != null ? <span className="num">₹{totals.perKm.toFixed(2)}</span> : <span className="unavailable">—</span>}
              />
              <Figure
                label="Last service"
                value={totals.lastService
                  ? <span className="num" style={{ fontSize: 15 }}>{formatDate(totals.lastService.date)}</span>
                  : <span className="unavailable">—</span>}
                sub={totals.lastService ? `at ${fmtNumber(totals.lastService.odometer)} km` : 'None recorded'}
              />
              <Figure
                label="Next service due"
                value={service?.nextServiceDue
                  ? <span className="num" style={{ fontSize: 15 }}>{formatDate(service.nextServiceDue)}</span>
                  : <span className="unavailable">—</span>}
                sub={serviceDays != null ? relativeDays(serviceDays) : 'Not scheduled'}
              />
            </Figures>
            <DataTable
              rows={rows}
              columns={columns}
              getKey={(m) => m.id}
              caption={`Maintenance history for ${vehicle.name}`}
            />
          </>
        )}
      </Section>
    </div>
  )
}
