/**
 * Derived views over the store.
 *
 * Nothing here is stored — every function recomputes from the records, which is
 * why the fleet registry, a vehicle's financials, analytics and the CSV exports
 * can never disagree about a number.
 */

import { useMemo } from 'react'
import {
  buildLedger, driverLedger, inRange, summarise,
  type DateRange, type FinancialSummary, type DriverLedger,
} from './calc'
import { useDb } from './store'
import type {
  Database, Driver, LedgerLine, Maintenance, Trip, Vehicle,
} from './types'

export function useLedger(): LedgerLine[] {
  const db = useDb()
  return useMemo(() => buildLedger(db), [db])
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function driverOfVehicle(db: Database, vehicleId: string): Driver | undefined {
  return db.drivers.find((d) => d.assignedVehicleId === vehicleId)
}

/* ------------------------------------------------------------------ */
/* Scoped record slices                                                */
/* ------------------------------------------------------------------ */

export interface Scope {
  /** `null` scopes to the whole business. */
  vehicleId: string | null
  range: DateRange
}

export interface ScopedRecords {
  trips: Trip[]
  ledger: LedgerLine[]
  fuel: Database['fuel']
  maintenance: Maintenance[]
}

export function scopeRecords(db: Database, ledger: LedgerLine[], scope: Scope): ScopedRecords {
  const { vehicleId, range } = scope
  const vehicleMatch = <T extends { vehicleId: string | null }>(r: T) =>
    vehicleId === null || r.vehicleId === vehicleId
  return {
    trips: db.trips.filter((t) => vehicleMatch(t) && inRange(t.date, range)),
    ledger: ledger.filter((l) => vehicleMatch(l) && inRange(l.date, range)),
    fuel: db.fuel.filter((f) => vehicleMatch(f) && inRange(f.date, range)),
    maintenance: db.maintenance.filter((m) => vehicleMatch(m) && inRange(m.date, range)),
  }
}

export function summaryFor(db: Database, ledger: LedgerLine[], scope: Scope): FinancialSummary {
  const records = scopeRecords(db, ledger, scope)
  return summarise({ trips: records.trips, ledger: records.ledger, fuel: records.fuel })
}

export function useSummary(scope: Scope): FinancialSummary {
  const db = useDb()
  const ledger = useLedger()
  return useMemo(() => summaryFor(db, ledger, scope), [db, ledger, scope])
}

export function useScopedRecords(scope: Scope): ScopedRecords {
  const db = useDb()
  const ledger = useLedger()
  return useMemo(() => scopeRecords(db, ledger, scope), [db, ledger, scope])
}

/* ------------------------------------------------------------------ */
/* Fleet registry                                                      */
/* ------------------------------------------------------------------ */

export interface VehicleRow {
  vehicle: Vehicle
  driver: Driver | undefined
  summary: FinancialSummary
}

export function useFleetRows(range: DateRange): VehicleRow[] {
  const db = useDb()
  const ledger = useLedger()
  return useMemo(
    () =>
      db.vehicles.map((vehicle) => ({
        vehicle,
        driver: driverOfVehicle(db, vehicle.id),
        summary: summaryFor(db, ledger, { vehicleId: vehicle.id, range }),
      })),
    [db, ledger, range],
  )
}

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

export interface DriverRow {
  driver: Driver
  vehicle: Vehicle | undefined
  account: DriverLedger
  trips: number
  kilometres: number
  /** Freight earned by the trips this driver ran — how much work they brought in. */
  revenue: number
}

export function useDriverRows(today: string, range: DateRange): DriverRow[] {
  const db = useDb()
  return useMemo(
    () =>
      db.drivers.map((driver) => {
        const payments = db.driverPayments.filter((p) => p.driverId === driver.id)
        const trips = db.trips.filter(
          (t) => t.driverId === driver.id && t.status === 'completed' && inRange(t.date, range),
        )
        return {
          driver,
          vehicle: db.vehicles.find((v) => v.id === driver.assignedVehicleId),
          account: driverLedger(payments, driver.salary, driver.joiningDate, today),
          trips: trips.length,
          kilometres: trips.reduce((a, t) => a + t.kilometres, 0),
          revenue: trips.reduce((a, t) => a + t.freightAmount, 0),
        }
      }),
    [db, today, range],
  )
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

export type ActivityKind = 'trip' | 'fuel' | 'expense' | 'maintenance' | 'driver-payment'

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  date: string
  title: string
  detail: string
  /** Positive amounts are income, negative are cost. */
  amount: number
  vehicleId: string | null
}

/** Merged, newest-first stream of everything that happened, for a vehicle or the fleet. */
export function buildActivity(db: Database, vehicleId: string | null, limit = 12): ActivityEvent[] {
  const match = (id: string | null) => vehicleId === null || id === vehicleId
  const events: ActivityEvent[] = []
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name]))
  const suffix = (id: string | null) =>
    vehicleId === null && id ? ` · ${vehicleName.get(id) ?? ''}` : ''

  for (const t of db.trips) {
    if (!match(t.vehicleId)) continue
    events.push({
      id: `trip-${t.id}`, kind: 'trip', date: t.date,
      title: `${t.startLocation} → ${t.destination}`,
      detail: `${t.reference} · ${t.tonnage} t${suffix(t.vehicleId)}`,
      amount: t.status === 'completed' ? t.freightAmount : 0,
      vehicleId: t.vehicleId,
    })
  }
  for (const f of db.fuel) {
    if (!match(f.vehicleId)) continue
    events.push({
      id: `fuel-${f.id}`, kind: 'fuel', date: f.date,
      title: `Diesel · ${f.litres} L`,
      detail: `${f.fuelStation}${suffix(f.vehicleId)}`,
      amount: -f.totalAmount, vehicleId: f.vehicleId,
    })
  }
  for (const e of db.expenses) {
    if (!match(e.vehicleId)) continue
    events.push({
      id: `exp-${e.id}`, kind: 'expense', date: e.date,
      title: e.description, detail: `Expense${suffix(e.vehicleId)}`,
      amount: -e.amount, vehicleId: e.vehicleId,
    })
  }
  for (const m of db.maintenance) {
    if (!match(m.vehicleId)) continue
    events.push({
      id: `maint-${m.id}`, kind: 'maintenance', date: m.date,
      title: m.description, detail: `Maintenance${suffix(m.vehicleId)}`,
      amount: -m.cost, vehicleId: m.vehicleId,
    })
  }
  const driverVehicle = new Map(db.drivers.map((d) => [d.id, d.assignedVehicleId]))
  const driverName = new Map(db.drivers.map((d) => [d.id, d.name]))
  for (const p of db.driverPayments) {
    const vid = driverVehicle.get(p.driverId) ?? null
    if (!match(vid)) continue
    events.push({
      id: `dpay-${p.id}`, kind: 'driver-payment', date: p.date,
      title: `${driverName.get(p.driverId) ?? 'Driver'} · ${p.notes ?? 'Payment'}`,
      detail: `Driver payment${suffix(vid)}`,
      amount: -p.amount, vehicleId: vid,
    })
  }

  return events
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, limit)
}

export function useActivity(vehicleId: string | null, limit?: number): ActivityEvent[] {
  const db = useDb()
  return useMemo(() => buildActivity(db, vehicleId, limit), [db, vehicleId, limit])
}

/* ------------------------------------------------------------------ */
/* Maintenance scheduling                                              */
/* ------------------------------------------------------------------ */

/** The latest record that named a next-service date, per vehicle. */
export function nextServiceFor(db: Database, vehicleId: string): Maintenance | undefined {
  return db.maintenance
    .filter((m) => m.vehicleId === vehicleId && m.nextServiceDue)
    .sort((a, b) => (a.nextServiceDue! < b.nextServiceDue! ? 1 : -1))[0]
}
