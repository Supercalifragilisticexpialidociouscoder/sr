/**
 * Vehicle detail — a complete operational profile for one vehicle.
 *
 * Everything on this page belongs to this vehicle, and one date range governs
 * all of it: the header figures, every tab, and the financial statement. There
 * is no way for two parts of the page to be describing different periods.
 */

import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, IconButton } from '../../ui/Button'
import {
  Figure, Figures, Money, PageHeader, Plate, Readout, Section,
} from '../../ui/primitives'
import { RangeFilter, useRangeState } from '../../ui/RangeFilter'
import { useConfirm } from '../../ui/Confirm'
import { useToast } from '../../ui/Toast'
import { useForms } from '../forms/FormsProvider'
import { Ratio, useToday, VehicleStatusBadge } from '../shared'
import { useStore } from '../../data/store'
import { driverOfVehicle, useScopedRecords, useSummary } from '../../data/selectors'
import { km as formatKm, marginNote, number as fmtNumber, tonnes } from '../../data/format'
import { VEHICLE_TYPE_LABEL } from '../../data/types'
import { EditIcon, PlusIcon, TrashIcon } from '../../ui/icons'
import { OverviewTab } from './tabs/OverviewTab'
import { DriversTab } from './tabs/DriversTab'
import { TripsTab } from './tabs/TripsTab'
import { FuelTab } from './tabs/FuelTab'
import { ExpensesTab } from './tabs/ExpensesTab'
import { MaintenanceTab } from './tabs/MaintenanceTab'
import { FinancialsTab } from './tabs/FinancialsTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'trips', label: 'Trips / Workout' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'financials', label: 'Financials' },
] as const

type TabId = (typeof TABS)[number]['id']

export function VehicleDetailPage() {
  const { vehicleId, tab } = useParams()
  const { db, dispatch } = useStore()
  const today = useToday()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()

  const rangeState = useRangeState(today, 'all')
  const scope = { vehicleId: vehicleId ?? null, range: rangeState.range }
  const summary = useSummary(scope)
  const records = useScopedRecords(scope)

  const vehicle = db.vehicles.find((v) => v.id === vehicleId)
  if (!vehicle) return <Navigate to="/fleet" replace />

  const activeTab: TabId = (TABS.find((t) => t.id === tab)?.id ?? 'overview')
  const driver = driverOfVehicle(db, vehicle.id)
  const spec = [vehicle.manufacturer, vehicle.model, vehicle.manufacturingYear]
    .filter(Boolean).join(' ')

  const counts = {
    trips: records.trips.length,
    fuel: records.fuel.length,
    expenses: records.ledger.length,
    maintenance: records.maintenance.length,
    drivers: db.drivers.filter((d) => d.assignedVehicleId === vehicle.id).length,
  }

  const removeVehicle = async () => {
    const trips = db.trips.filter((t) => t.vehicleId === vehicle.id).length
    const fuel = db.fuel.filter((f) => f.vehicleId === vehicle.id).length
    const expenses = db.expenses.filter((e) => e.vehicleId === vehicle.id).length
    const maintenance = db.maintenance.filter((m) => m.vehicleId === vehicle.id).length
    const ok = await confirm({
      title: `Remove ${vehicle.name}?`,
      body: `This permanently deletes ${trips} trips, ${fuel} fuel entries, ${expenses} expenses and ${maintenance} maintenance records logged against ${vehicle.registrationNumber}. Fleet totals, analytics and reports will all change. ${driver ? `${driver.name} will be unassigned but kept.` : ''}`,
      confirmLabel: 'Remove vehicle and its records',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'vehicle/remove', id: vehicle.id })
    toast.success(`${vehicle.name} removed from the fleet`)
    navigate('/fleet')
  }

  const tabProps = { vehicle, records, summary, range: rangeState.range, today }

  return (
    <div className="page stack stack-8">
      <PageHeader
        title={vehicle.name}
        back={{ to: '/fleet', label: 'Fleet' }}
        meta={
          <>
            <Plate value={vehicle.registrationNumber} large />
            <VehicleStatusBadge status={vehicle.status} />
            <span>{VEHICLE_TYPE_LABEL[vehicle.type]}</span>
            {spec && <><span className="registry-meta-sep">·</span><span>{spec}</span></>}
            <span className="registry-meta-sep">·</span>
            <span>{driver ? driver.name : 'No driver assigned'}</span>
            {vehicle.odometer > 0 && (
              <>
                <span className="registry-meta-sep">·</span>
                <span className="mono">{fmtNumber(vehicle.odometer)} km</span>
              </>
            )}
          </>
        }
        actions={
          <>
            <IconButton label={`Edit ${vehicle.name}`} onClick={() => openForm({ kind: 'vehicle', edit: vehicle })}>
              <EditIcon size={16} />
            </IconButton>
            <IconButton label={`Remove ${vehicle.name}`} onClick={removeVehicle}>
              <TrashIcon size={16} />
            </IconButton>
            <Button
              variant="primary"
              icon={<PlusIcon size={15} />}
              onClick={() => openForm({ kind: 'trip', vehicleId: vehicle.id })}
            >
              Log trip
            </Button>
          </>
        }
      />

      <Section id="vehicle-performance" title="Performance" actions={<RangeFilter state={rangeState} compact />}>
        <Readout
          label="Net profit"
          value={<Money value={summary.netProfit} polarity="auto" display />}
          tone={summary.netProfit < 0 ? 'negative' : summary.netProfit > 0 ? 'positive' : 'none'}
          note={[marginNote(summary.netProfit, summary.grossIncome, summary.expenses), `${fmtNumber(summary.trips)} completed ${summary.trips === 1 ? 'trip' : 'trips'}`].filter(Boolean).join(' · ')}
        >
          <Figures cols={2}>
            <Figure label="Gross income" value={<Money value={summary.grossIncome} />} />
            <Figure label="Trips" value={fmtNumber(summary.trips)}
              sub={summary.inTransitTrips > 0 ? `+${summary.inTransitTrips} running` : undefined} />
            <Figure label="Total expenses" value={<Money value={summary.expenses} />} />
            <Figure label="Distance" value={formatKm(summary.kilometres)} />
            <Figure label="Cost per km" value={<Ratio value={summary.costPerKm} />} />
            <Figure label="Tonnage" value={tonnes(summary.tonnage)} />
            <Figure label="Cost per tonne" value={<Ratio value={summary.costPerTon} />} />
            <Figure label="Diesel" value={<Money value={summary.fuelCost} />} />
            {summary.adblueCost > 0 && <Figure label="AdBlue" value={<Money value={summary.adblueCost} />} />}
            {summary.fastagCost > 0 && <Figure label="FASTag" value={<Money value={summary.fastagCost} />} />}
          </Figures>
        </Readout>
      </Section>

      <nav className="tabs" aria-label="Vehicle sections">
        {TABS.map((t) => {
          const count =
            t.id === 'trips' ? counts.trips
              : t.id === 'fuel' ? counts.fuel
                : t.id === 'expenses' ? counts.expenses
                  : t.id === 'maintenance' ? counts.maintenance
                    : t.id === 'drivers' ? counts.drivers
                      : null
          return (
            <button
              key={t.id}
              type="button"
              className={`tab${activeTab === t.id ? ' tab-on' : ''}`}
              aria-current={activeTab === t.id ? 'page' : undefined}
              onClick={() => navigate(`/fleet/vehicles/${vehicle.id}${t.id === 'overview' ? '' : `/${t.id}`}`)}
            >
              {t.label}
              {count != null && count > 0 && <span className="tab-count">{count}</span>}
            </button>
          )
        })}
      </nav>

      <div>
        {activeTab === 'overview' && <OverviewTab {...tabProps} />}
        {activeTab === 'drivers' && <DriversTab {...tabProps} />}
        {activeTab === 'trips' && <TripsTab {...tabProps} />}
        {activeTab === 'fuel' && <FuelTab {...tabProps} />}
        {activeTab === 'expenses' && <ExpensesTab {...tabProps} />}
        {activeTab === 'maintenance' && <MaintenanceTab {...tabProps} />}
        {activeTab === 'financials' && <FinancialsTab {...tabProps} />}
      </div>
    </div>
  )
}
