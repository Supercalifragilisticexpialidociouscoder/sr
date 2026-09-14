/**
 * Turning an inspected workbook into records the product can hold.
 *
 * Split into two stages on purpose. `analyseSheets` is cheap and decides what
 * each sheet looks like; the review screen lets a person correct that. `build`
 * then applies whatever mapping is in force. Changing a mapping re-runs only
 * the second stage, so the review screen stays live rather than making the
 * user re-upload to see the effect of a correction.
 */

import type {
  Database, Driver, DriverPayment, Expense, ExpenseCategory, FuelEntry,
  ImportIssue, Maintenance, SheetKind, Trip, Vehicle,
} from '../types'
import { CATEGORY_SOURCE, MAINTENANCE_CATEGORY } from '../types'
import { tripFreight } from '../calc'
import { plate as formatPlate, todayISO } from '../format'
import {
  category as toCategory, date as toDate, key, looksLikeRegistration, number as toNumber,
  paymentMethod as toPaymentMethod, positive, registrationKey, text, tripStatus,
  type Cell,
} from './normalize'
import { classifySheet, findHeaderRow, mapHeaders, SHEET_SCHEMAS, type HeaderMatch } from './fields'

export interface RawSheet {
  name: string
  rows: Cell[][]
}

export interface SheetPlan {
  name: string
  kind: SheetKind
  confidence: number
  headerRow: number
  headers: string[]
  /** column index → canonical field id */
  mapping: Record<number, string>
  /** Rows below the header, ready to build from. */
  bodyRows: Cell[][]
  /** A few real values per column, so the review screen can show what was read. */
  samples: Record<number, string[]>
}

/* ------------------------------------------------------------------ */
/* Stage one: work out what each sheet is                              */
/* ------------------------------------------------------------------ */

export function analyseSheets(sheets: RawSheet[]): SheetPlan[] {
  return sheets.map((sheet) => {
    const rows = sheet.rows.filter((r) => r.some((c) => c != null && String(c).trim() !== ''))
    if (rows.length === 0) {
      return {
        name: sheet.name, kind: 'unknown' as SheetKind, confidence: 0, headerRow: 0,
        headers: [], mapping: {}, bodyRows: [], samples: {},
      }
    }

    const headerRow = findHeaderRow(rows)
    const headers = (rows[headerRow] ?? []).map((c) => text(c))
    const bodyRows = rows.slice(headerRow + 1)
    const { kind, confidence, mapping } = classifySheet(sheet.name, headers)

    const samples: Record<number, string[]> = {}
    headers.forEach((_, column) => {
      const values: string[] = []
      for (const row of bodyRows) {
        const v = text(row[column])
        if (v) values.push(v)
        if (values.length === 3) break
      }
      samples[column] = values
    })

    return {
      name: sheet.name,
      kind,
      confidence,
      headerRow,
      headers,
      mapping: Object.fromEntries([...mapping].map(([c, m]) => [c, m.fieldId])),
      bodyRows,
      samples,
    }
  })
}

/** Re-maps a sheet's columns after the user changes its detected kind. */
export function remapForKind(plan: SheetPlan, kind: SheetKind): SheetPlan {
  const schema = SHEET_SCHEMAS.find((s) => s.kind === kind)
  if (!schema) return { ...plan, kind, mapping: {} }
  const mapping = mapHeaders(plan.headers, schema)
  return {
    ...plan,
    kind,
    mapping: Object.fromEntries([...mapping].map(([c, m]: [number, HeaderMatch]) => [c, m.fieldId])),
  }
}

/* ------------------------------------------------------------------ */
/* Stage two: build records                                            */
/* ------------------------------------------------------------------ */

export interface BuildResult {
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  maintenance: Maintenance[]
  driverPayments: DriverPayment[]
  /** Vehicles and drivers the workbook referred to that do not exist yet. */
  newVehicles: Vehicle[]
  newDrivers: Driver[]
  /** Records whose fingerprint already exists, kept aside for the user to decide. */
  duplicates: number
  duplicateKeys: Set<string>
  issues: ImportIssue[]
  perSheet: Record<string, { imported: number; skipped: number; duplicates: number }>
}

let counter = 0
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`

/** Identity of a record for duplicate purposes — see `dedupe` in the docs. */
function fingerprint(parts: (string | number | null | undefined)[]): string {
  return parts.map((p) => (p == null ? '' : String(p).toLowerCase().trim())).join('|')
}

export function existingFingerprints(db: Database): Set<string> {
  const set = new Set<string>()
  for (const t of db.trips) set.add(fingerprint(['trip', t.date, t.vehicleId, Math.round(t.freightAmount), t.reference || `${t.startLocation}>${t.destination}`]))
  for (const f of db.fuel) set.add(fingerprint(['fuel', f.date, f.vehicleId, f.product, Math.round(f.totalAmount), Math.round(f.litres)]))
  for (const e of db.expenses) set.add(fingerprint(['exp', e.date, e.vehicleId, e.category, Math.round(e.amount)]))
  for (const m of db.maintenance) set.add(fingerprint(['maint', m.date, m.vehicleId, m.type, Math.round(m.cost)]))
  for (const p of db.driverPayments) set.add(fingerprint(['dpay', p.date, p.driverId, p.type, Math.round(p.amount)]))
  return set
}

interface Resolver {
  vehicleId: (cell: Cell) => string | null
  driverId: (cell: Cell) => string | null
  newVehicles: Vehicle[]
  newDrivers: Driver[]
}

/**
 * Resolves the names in a spreadsheet to the entities already in the database,
 * creating one only when the workbook genuinely introduces something new.
 *
 * Vehicles match on their registration with punctuation removed, so
 * `TS09AB1234`, `TS 09 AB 1234` and `TS-09-AB-1234` all land on one truck
 * instead of creating three.
 */
function makeResolver(db: Database, importId: string): Resolver {
  const byReg = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const v of db.vehicles) {
    byReg.set(registrationKey(v.registrationNumber), v.id)
    if (v.name) byName.set(key(v.name), v.id)
  }
  const drivers = new Map<string, string>()
  for (const d of db.drivers) drivers.set(key(d.name), d.id)

  const newVehicles: Vehicle[] = []
  const newDrivers: Driver[] = []
  const stamp = new Date().toISOString()

  return {
    newVehicles,
    newDrivers,
    vehicleId(cell) {
      const raw = text(cell)
      if (!raw) return null
      const reg = registrationKey(raw)
      if (byReg.has(reg)) return byReg.get(reg)!
      // The sheet may refer to a truck by its yard name rather than its plate.
      const named = byName.get(key(raw))
      if (named) return named

      const id = nextId('v')
      // Store the canonical spelling, not whichever one this sheet happened to
      // use: `plate()` renders it back as "TG 08 V 7396" wherever it is shown.
      const isReg = looksLikeRegistration(raw)
      const canonical = isReg ? reg : raw
      const vehicle: Vehicle = {
        id,
        registrationNumber: canonical,
        name: isReg ? formatPlate(canonical) : raw,
        type: '12-wheeler',
        fuelType: 'diesel',
        tankCapacity: 0,
        odometer: 0,
        status: 'active',
        createdAt: stamp,
        updatedAt: stamp,
        importId,
      }
      byReg.set(reg, id)
      byName.set(key(raw), id)
      newVehicles.push(vehicle)
      return id
    },
    driverId(cell) {
      const raw = text(cell)
      if (!raw) return null
      const k = key(raw)
      if (drivers.has(k)) return drivers.get(k)!
      const id = nextId('d')
      newDrivers.push({
        id, name: raw, phone: '', licenseNumber: '',
        joiningDate: todayISO(), assignedVehicleId: null, salary: 0,
        createdAt: stamp, updatedAt: stamp, importId,
      })
      drivers.set(k, id)
      return id
    },
  }
}

export interface BuildOptions {
  /** When true, rows matching an existing record are imported anyway. */
  allowDuplicates?: boolean
}

export function build(
  db: Database,
  plans: SheetPlan[],
  importId: string,
  options: BuildOptions = {},
): BuildResult {
  const resolver = makeResolver(db, importId)
  const seen = existingFingerprints(db)
  const out: BuildResult = {
    trips: [], fuel: [], expenses: [], maintenance: [], driverPayments: [],
    newVehicles: resolver.newVehicles, newDrivers: resolver.newDrivers,
    duplicates: 0, duplicateKeys: new Set(), issues: [], perSheet: {},
  }

  for (const plan of plans) {
    if (plan.kind === 'unknown') continue
    const tally = { imported: 0, skipped: 0, duplicates: 0 }
    out.perSheet[plan.name] = tally

    const col = (fieldId: string): number | null => {
      for (const [c, f] of Object.entries(plan.mapping)) if (f === fieldId) return Number(c)
      return null
    }
    const get = (row: Cell[], fieldId: string): Cell => {
      const c = col(fieldId)
      return c == null ? null : row[c]
    }

    plan.bodyRows.forEach((row, index) => {
      const rowNumber = plan.headerRow + index + 2  // 1-based, past the header
      const fail = (problem: string, suggestion?: string) => {
        tally.skipped += 1
        out.issues.push({
          sheet: plan.name, row: rowNumber, problem, suggestion,
          values: row.slice(0, 8).map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : (c as string | number | null) ?? null)),
        })
      }
      const accept = (fp: string): boolean => {
        if (seen.has(fp)) {
          tally.duplicates += 1
          out.duplicates += 1
          out.duplicateKeys.add(fp)
          // Counted either way, so the review screen can report how many were
          // found even when the user has chosen to bring them in regardless.
          if (!options.allowDuplicates) return false
        }
        seen.add(fp)
        tally.imported += 1
        return true
      }

      // A row with nothing in it is the blank line under the table, not an error.
      if (row.every((c) => c == null || String(c).trim() === '')) return

      switch (plan.kind) {
        case 'vehicles': {
          const reg = text(get(row, 'registration'))
          if (!reg) return fail('No registration number', 'Add the vehicle number to this row')
          resolver.vehicleId(reg)
          tally.imported += 1
          return
        }

        case 'drivers': {
          const name = text(get(row, 'name'))
          if (!name) return fail('No driver name')
          const id = resolver.driverId(name)
          const created = resolver.newDrivers.find((d) => d.id === id)
          if (created) {
            created.phone = text(get(row, 'phone'))
            created.licenseNumber = text(get(row, 'license'))
            created.licenseExpiry = toDate(get(row, 'licenseExpiry')) ?? undefined
            created.joiningDate = toDate(get(row, 'joiningDate')) ?? todayISO()
            created.salary = toNumber(get(row, 'salary')) ?? 0
            created.assignedVehicleId = resolver.vehicleId(get(row, 'vehicle'))
          }
          tally.imported += 1
          return
        }

        case 'trips': {
          const date = toDate(get(row, 'date'))
          if (!date) return fail('Missing or unreadable date', 'Use a date like 04/09/2026')
          const vehicleId = resolver.vehicleId(get(row, 'vehicle'))
          if (!vehicleId) return fail('No vehicle number', 'Add the vehicle this trip ran on')

          const tonnage = positive(get(row, 'tonnage')) ?? 0
          const rate = positive(get(row, 'ratePerTon')) ?? 0
          const stated = toNumber(get(row, 'freight'))
          const computed = tripFreight(tonnage, rate)
          const freight = stated ?? computed
          if (freight <= 0) return fail('No freight amount and none could be calculated',
            'Add a freight amount, or tonnage and a rate per tonne')

          const fp = fingerprint(['trip', date, vehicleId, Math.round(freight),
            text(get(row, 'reference')) || `${text(get(row, 'from'))}>${text(get(row, 'to'))}`])
          if (!accept(fp)) return

          out.trips.push({
            id: nextId('t'), date, importId,
            reference: text(get(row, 'reference')),
            vehicleId,
            driverId: resolver.driverId(get(row, 'driver')),
            startLocation: text(get(row, 'from')),
            destination: text(get(row, 'to')),
            kilometres: positive(get(row, 'km')) ?? 0,
            tonnage,
            pricePerTon: rate,
            freightAmount: freight,
            // Flagged when the sheet's own total disagrees with tonnage × rate,
            // so the figure is never silently "corrected".
            freightOverride: stated != null && computed > 0 && Math.abs(stated - computed) > 1,
            status: tripStatus(get(row, 'status')),
            notes: text(get(row, 'notes')) || undefined,
            createdAt: stamp(),
          })
          return
        }

        case 'fuel':
        case 'adblue': {
          const date = toDate(get(row, 'date'))
          if (!date) return fail('Missing or unreadable date')
          const vehicleId = resolver.vehicleId(get(row, 'vehicle'))
          if (!vehicleId) return fail('No vehicle number')

          const litres = positive(get(row, 'litres')) ?? 0
          const rate = positive(get(row, 'pricePerLitre')) ?? 0
          const stated = toNumber(get(row, 'amount'))
          const amount = stated ?? (litres && rate ? Math.round(litres * rate * 100) / 100 : 0)
          if (amount <= 0) return fail('No amount, and none could be calculated from litres × rate')

          const product = plan.kind === 'adblue' ? 'adblue' as const : 'diesel' as const
          const fp = fingerprint(['fuel', date, vehicleId, product, Math.round(amount), Math.round(litres)])
          if (!accept(fp)) return

          out.fuel.push({
            id: nextId('f'), date, product, vehicleId, importId,
            driverId: resolver.driverId(get(row, 'driver')),
            fuelStation: text(get(row, 'station')),
            litres,
            pricePerLitre: rate || (litres ? Math.round((amount / litres) * 100) / 100 : 0),
            totalAmount: amount,
            odometer: positive(get(row, 'odometer')) ?? 0,
            paymentMethod: toPaymentMethod(get(row, 'paymentMethod')),
            notes: text(get(row, 'notes')) || undefined,
            createdAt: stamp(),
          })
          return
        }

        case 'maintenance': {
          const date = toDate(get(row, 'date'))
          if (!date) return fail('Missing or unreadable date')
          const vehicleId = resolver.vehicleId(get(row, 'vehicle'))
          if (!vehicleId) return fail('No vehicle number')
          const cost = toNumber(get(row, 'cost'))
          if (cost == null || cost <= 0) return fail('No cost recorded')

          const cat = toCategory(get(row, 'type')) ?? toCategory(get(row, 'description')) ?? 'service'
          const type = maintenanceTypeFor(cat)
          const fp = fingerprint(['maint', date, vehicleId, type, Math.round(cost)])
          if (!accept(fp)) return

          out.maintenance.push({
            id: nextId('m'), date, vehicleId, type, cost, importId,
            odometer: positive(get(row, 'odometer')) ?? 0,
            description: text(get(row, 'description')) || text(get(row, 'type')),
            nextServiceDue: toDate(get(row, 'nextServiceDue')) ?? undefined,
            createdAt: stamp(),
          })
          return
        }

        case 'driver-payments': {
          const date = toDate(get(row, 'date'))
          if (!date) return fail('Missing or unreadable date')
          const driverId = resolver.driverId(get(row, 'driver'))
          if (!driverId) return fail('No driver name')
          const amount = toNumber(get(row, 'amount'))
          if (amount == null || amount <= 0) return fail('No amount recorded')

          const type = driverPaymentType(text(get(row, 'type')))
          const fp = fingerprint(['dpay', date, driverId, type, Math.round(amount)])
          if (!accept(fp)) return

          out.driverPayments.push({
            id: nextId('dp'), driverId, date, type, amount, importId,
            notes: text(get(row, 'notes')) || undefined,
            createdAt: stamp(),
          })
          return
        }

        case 'expenses': {
          const date = toDate(get(row, 'date'))
          if (!date) return fail('Missing or unreadable date')
          const amount = toNumber(get(row, 'amount'))
          if (amount == null || amount <= 0) return fail('No amount recorded')

          const label = text(get(row, 'category')) || text(get(row, 'description'))
          const cat = toCategory(label) ?? toCategory(plan.name) ?? 'other'
          const vehicleId = resolver.vehicleId(get(row, 'vehicle'))
          const description = text(get(row, 'description')) || label

          // Each category has one owning ledger, so an expense sheet row lands
          // wherever that category belongs. This is what makes it impossible to
          // count a diesel line twice just because the workbook filed it under
          // "expenses" as well as under "fuel".
          const owner = CATEGORY_SOURCE[cat]

          if (owner === 'fuel') {
            if (!vehicleId) return fail('No vehicle number on a fuel expense')
            const product = cat === 'adblue' ? 'adblue' as const : 'diesel' as const
            const litres = positive(get(row, 'litres')) ?? 0
            const fp = fingerprint(['fuel', date, vehicleId, product, Math.round(amount), Math.round(litres)])
            if (!accept(fp)) return
            out.fuel.push({
              id: nextId('f'), date, product, vehicleId, importId, driverId: null,
              fuelStation: text(get(row, 'reference')) || description,
              litres, pricePerLitre: 0, totalAmount: amount, odometer: 0,
              paymentMethod: toPaymentMethod(get(row, 'paymentMethod')),
              notes: description || undefined,
              createdAt: stamp(),
            })
            return
          }

          if (owner === 'maintenance') {
            if (!vehicleId) return fail('No vehicle number on a maintenance expense')
            const type = maintenanceTypeFor(cat)
            const fp = fingerprint(['maint', date, vehicleId, type, Math.round(amount)])
            if (!accept(fp)) return
            out.maintenance.push({
              id: nextId('m'), date, vehicleId, type, cost: amount, importId,
              odometer: positive(get(row, 'odometer')) ?? 0,
              description, createdAt: stamp(),
            })
            return
          }

          if (owner === 'driver') {
            const driverId = resolver.driverId(get(row, 'driver'))
            if (!driverId) {
              // A driver cost with no name is still a real cost; keep it on the
              // vehicle as a direct expense rather than discarding it.
              const fp = fingerprint(['exp', date, vehicleId, 'other', Math.round(amount)])
              if (!accept(fp)) return
              out.expenses.push({
                id: nextId('e'), date, vehicleId, category: 'other', amount, importId,
                description: description || 'Driver expense',
                paymentMethod: toPaymentMethod(get(row, 'paymentMethod')),
                reference: text(get(row, 'reference')) || undefined,
                createdAt: stamp(),
              })
              return
            }
            const type = driverPaymentType(label)
            const fp = fingerprint(['dpay', date, driverId, type, Math.round(amount)])
            if (!accept(fp)) return
            out.driverPayments.push({
              id: nextId('dp'), driverId, date, type, amount, importId,
              notes: description || undefined, createdAt: stamp(),
            })
            return
          }

          const fp = fingerprint(['exp', date, vehicleId, cat, Math.round(amount)])
          if (!accept(fp)) return
          out.expenses.push({
            id: nextId('e'), date, vehicleId, category: cat, amount, importId,
            description,
            paymentMethod: toPaymentMethod(get(row, 'paymentMethod')),
            reference: text(get(row, 'reference')) || undefined,
            createdAt: stamp(),
          })
          return
        }
      }
    })
  }

  return out
}

function stamp(): string {
  return new Date().toISOString()
}

function maintenanceTypeFor(cat: ExpenseCategory): Maintenance['type'] {
  for (const [type, mapped] of Object.entries(MAINTENANCE_CATEGORY)) {
    if (mapped === cat) return type as Maintenance['type']
  }
  return 'service'
}

function driverPaymentType(label: string): DriverPayment['type'] {
  const raw = label.toLowerCase()
  if (/advance|adv\b/.test(raw)) return 'advance'
  if (/batta|bata|trip|khoraki|allowance/.test(raw)) return 'trip-payment'
  if (/salary|wage|pay/.test(raw)) return 'salary'
  return 'other'
}
