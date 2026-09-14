/**
 * The single source of truth.
 *
 * One reducer holds every record. Screens never keep their own copy of a
 * number — they read from here through the selectors in `selectors.ts`, so
 * logging a trip updates the vehicle, the fleet registry, analytics and the
 * reports in the same render.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef,
  type ReactNode,
} from 'react'
import type {
  Database, Driver, DriverPayment, Expense, FuelEntry, ImportBatch, Maintenance,
  Trip, Vehicle,
} from './types'

/** The records one import adds. Mirrors `BuildResult` without the review data. */
export interface ImportCommit {
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  maintenance: Maintenance[]
  driverPayments: DriverPayment[]
}
import { createInitialDatabase, EMPTY_DATABASE } from './initial'

const STORAGE_KEY = 'sre.fleet.v2'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 8)
  return Math.random().toString(36).slice(2, 10)
}

type Status = 'loading' | 'ready' | 'error'

interface State {
  status: Status
  db: Database
  error: string | null
}

type Action =
  | { type: 'hydrated'; db: Database }
  | { type: 'failed'; error: string }
  | { type: 'vehicle/add'; payload: Vehicle }
  | { type: 'vehicle/update'; payload: Vehicle }
  | { type: 'vehicle/remove'; id: string }
  | { type: 'driver/add'; payload: Driver }
  | { type: 'driver/update'; payload: Driver }
  | { type: 'driver/remove'; id: string }
  | { type: 'trip/add'; payload: Trip }
  | { type: 'trip/update'; payload: Trip }
  | { type: 'trip/remove'; id: string }
  | { type: 'fuel/add'; payload: FuelEntry }
  | { type: 'fuel/update'; payload: FuelEntry }
  | { type: 'fuel/remove'; id: string }
  | { type: 'expense/add'; payload: Expense }
  | { type: 'expense/update'; payload: Expense }
  | { type: 'expense/remove'; id: string }
  | { type: 'maintenance/add'; payload: Maintenance }
  | { type: 'maintenance/update'; payload: Maintenance }
  | { type: 'maintenance/remove'; id: string }
  | { type: 'driverPayment/add'; payload: DriverPayment }
  | { type: 'driverPayment/remove'; id: string }
  | { type: 'db/replace'; db: Database }
  | { type: 'import/commit'; batch: ImportBatch; result: ImportCommit }
  | { type: 'import/undo'; importId: string }

/** Newest first, so every list in the product reads the same way by default. */
function byDateDesc<T extends { date: string; createdAt?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (b.createdAt ?? '') < (a.createdAt ?? '') ? -1 : 1
  })
}

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((r) => r.id === row.id)
  if (index === -1) return [row, ...rows]
  const next = [...rows]
  next[index] = row
  return next
}

function reducer(state: State, action: Action): State {
  const { db } = state
  switch (action.type) {
    case 'hydrated':
      return { status: 'ready', db: action.db, error: null }
    case 'failed':
      return { ...state, status: 'error', error: action.error }
    case 'db/replace':
      return { ...state, db: action.db }

    case 'import/commit': {
      const r = action.result
      // Odometers move forward from whatever the import knows, never backwards.
      const highest = new Map<string, number>()
      for (const f of r.fuel) {
        if (f.odometer > (highest.get(f.vehicleId) ?? 0)) highest.set(f.vehicleId, f.odometer)
      }
      const vehicles = [...db.vehicles, ...r.vehicles].map((v) => {
        const reading = highest.get(v.id)
        return reading && reading > v.odometer ? { ...v, odometer: reading } : v
      })
      return {
        ...state,
        db: {
          vehicles,
          drivers: [...db.drivers, ...r.drivers],
          trips: byDateDesc([...db.trips, ...r.trips]),
          fuel: byDateDesc([...db.fuel, ...r.fuel]),
          expenses: byDateDesc([...db.expenses, ...r.expenses]),
          maintenance: byDateDesc([...db.maintenance, ...r.maintenance]),
          driverPayments: byDateDesc([...db.driverPayments, ...r.driverPayments]),
          imports: [action.batch, ...db.imports],
        },
      }
    }

    /** Removes everything one import brought in, leaving other records alone. */
    case 'import/undo': {
      const id = action.importId
      const keep = <T extends { importId?: string }>(rows: T[]) => rows.filter((r) => r.importId !== id)
      return {
        ...state,
        db: {
          vehicles: keep(db.vehicles),
          drivers: keep(db.drivers),
          trips: keep(db.trips),
          fuel: keep(db.fuel),
          expenses: keep(db.expenses),
          maintenance: keep(db.maintenance),
          driverPayments: keep(db.driverPayments),
          imports: db.imports.filter((i) => i.id !== id),
        },
      }
    }

    case 'vehicle/add':
      return { ...state, db: { ...db, vehicles: [action.payload, ...db.vehicles] } }
    case 'vehicle/update':
      return { ...state, db: { ...db, vehicles: upsert(db.vehicles, action.payload) } }
    case 'vehicle/remove':
      // Removing a vehicle detaches its drivers and takes its records with it —
      // orphaned trips would silently distort every fleet-level total.
      return {
        ...state,
        db: {
          ...db,
          vehicles: db.vehicles.filter((v) => v.id !== action.id),
          drivers: db.drivers.map((d) =>
            d.assignedVehicleId === action.id ? { ...d, assignedVehicleId: null } : d),
          trips: db.trips.filter((t) => t.vehicleId !== action.id),
          fuel: db.fuel.filter((f) => f.vehicleId !== action.id),
          expenses: db.expenses.filter((e) => e.vehicleId !== action.id),
          maintenance: db.maintenance.filter((m) => m.vehicleId !== action.id),
        },
      }

    case 'driver/add':
      return { ...state, db: { ...db, drivers: [action.payload, ...db.drivers] } }
    case 'driver/update':
      return { ...state, db: { ...db, drivers: upsert(db.drivers, action.payload) } }
    case 'driver/remove':
      return {
        ...state,
        db: {
          ...db,
          drivers: db.drivers.filter((d) => d.id !== action.id),
          driverPayments: db.driverPayments.filter((p) => p.driverId !== action.id),
          trips: db.trips.map((t) => (t.driverId === action.id ? { ...t, driverId: null } : t)),
          fuel: db.fuel.map((f) => (f.driverId === action.id ? { ...f, driverId: null } : f)),
        },
      }

    case 'trip/add':
      return { ...state, db: { ...db, trips: byDateDesc([action.payload, ...db.trips]) } }
    case 'trip/update':
      return { ...state, db: { ...db, trips: byDateDesc(upsert(db.trips, action.payload)) } }
    case 'trip/remove':
      return { ...state, db: { ...db, trips: db.trips.filter((t) => t.id !== action.id) } }

    case 'fuel/add':
      return { ...state, db: { ...db, fuel: byDateDesc([action.payload, ...db.fuel]) } }
    case 'fuel/update':
      return { ...state, db: { ...db, fuel: byDateDesc(upsert(db.fuel, action.payload)) } }
    case 'fuel/remove':
      return { ...state, db: { ...db, fuel: db.fuel.filter((f) => f.id !== action.id) } }

    case 'expense/add':
      return { ...state, db: { ...db, expenses: byDateDesc([action.payload, ...db.expenses]) } }
    case 'expense/update':
      return { ...state, db: { ...db, expenses: byDateDesc(upsert(db.expenses, action.payload)) } }
    case 'expense/remove':
      return { ...state, db: { ...db, expenses: db.expenses.filter((e) => e.id !== action.id) } }

    case 'maintenance/add':
      return { ...state, db: { ...db, maintenance: byDateDesc([action.payload, ...db.maintenance]) } }
    case 'maintenance/update':
      return { ...state, db: { ...db, maintenance: byDateDesc(upsert(db.maintenance, action.payload)) } }
    case 'maintenance/remove':
      return { ...state, db: { ...db, maintenance: db.maintenance.filter((m) => m.id !== action.id) } }

    case 'driverPayment/add':
      return { ...state, db: { ...db, driverPayments: byDateDesc([action.payload, ...db.driverPayments]) } }
    case 'driverPayment/remove':
      return { ...state, db: { ...db, driverPayments: db.driverPayments.filter((p) => p.id !== action.id) } }
  }
}

interface StoreValue {
  status: Status
  error: string | null
  db: Database
  dispatch: React.Dispatch<Action>
  /** Restores the imported starting records, discarding later edits. */
  resetToImport: () => void
  /** Removes every record, to start from nothing. */
  clearAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

function readStored(): Database | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Database>
    if (!parsed || !Array.isArray(parsed.vehicles)) return null
    // Merge against the empty shape so a database written by an older build
    // gains new collections instead of crashing on `undefined.map`, then bring
    // individual records up to the current shape.
    return migrate({ ...EMPTY_DATABASE, ...parsed } as Database)
  } catch {
    return null
  }
}

/**
 * Brings a stored database up to the current record shape.
 *
 * Runs on every load and must stay cheap and total: a browser holding records
 * from an earlier build has to keep working, not be silently dropped.
 */
function migrate(db: Database): Database {
  const needsProduct = db.fuel.some((f) => !f.product)
  if (!needsProduct) return db
  return {
    ...db,
    // Fuel predates the diesel/AdBlue split, so it is all diesel.
    fuel: db.fuel.map((f) => (f.product ? f : { ...f, product: 'diesel' as const })),
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'loading',
    db: EMPTY_DATABASE,
    error: null,
  })
  const hydrated = useRef(false)

  useEffect(() => {
    let cancelled = false
    // Deferred a frame so the loading state is real rather than theatrical:
    // parsing a large stored database genuinely takes a moment on a phone.
    const handle = window.setTimeout(() => {
      if (cancelled) return
      try {
        const stored = readStored()
        const db = stored ?? createInitialDatabase()
        hydrated.current = true
        dispatch({ type: 'hydrated', db })
      } catch (err) {
        dispatch({ type: 'failed', error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }, 140)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'ready' || !hydrated.current) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db))
    } catch {
      // Storage full or blocked (private browsing). The session still works —
      // it simply will not survive a reload, which is better than a crash.
    }
  }, [state.db, state.status])

  const resetToImport = useCallback(() => {
    dispatch({ type: 'db/replace', db: createInitialDatabase() })
  }, [])

  const clearAll = useCallback(() => {
    dispatch({ type: 'db/replace', db: EMPTY_DATABASE })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({ status: state.status, error: state.error, db: state.db, dispatch, resetToImport, clearAll }),
    [state.status, state.error, state.db, resetToImport, clearAll],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export function useDb(): Database {
  return useStore().db
}
