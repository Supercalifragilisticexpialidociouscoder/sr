/**
 * Reports.
 *
 * Each report builds one table; the on-screen preview and the exported CSV read
 * the same table, so what the owner checks is exactly what lands in the
 * accountant's spreadsheet.
 *
 * CSV conventions chosen for Excel and Google Sheets:
 *  - a UTF-8 BOM, so `₹` and Tamil place names survive Excel's default import
 *  - RFC 4180 quoting, so a description containing a comma cannot shift columns
 *  - CRLF line endings, which Excel expects
 *  - raw unformatted numbers, so SUM() works without cleaning the column first
 *  - ISO dates, which both tools parse as dates rather than text
 */

import {
  CATEGORY_LABEL, PAYMENT_METHOD_LABEL,
  TRIP_STATUS_LABEL, VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL, FUEL_TYPE_LABEL,
  type Database, type LedgerLine,
} from './types'
import {
  driverLedger, inRange, safeDiv, summarise,
  type DateRange,
} from './calc'

export type CellValue = string | number | null

export interface ReportColumn {
  key: string
  label: string
  numeric?: boolean
  /** Decimal places when rendering the preview; CSV always carries full precision. */
  decimals?: number
}

export interface ReportTable {
  id: ReportId
  title: string
  description: string
  columns: ReportColumn[]
  rows: Record<string, CellValue>[]
  /** Totals row, keyed by column. Omitted where a total would be meaningless. */
  totals?: Record<string, CellValue>
  filename: string
}

export type ReportId = 'trips' | 'fuel' | 'expenses' | 'vehicles' | 'drivers'

export const REPORTS: { id: ReportId; title: string; description: string }[] = [
  { id: 'trips', title: 'Trip / Workout report', description: 'Every trip with route, load, rate and freight earned.' },
  { id: 'fuel', title: 'Fuel report', description: 'Diesel fills with litres, rate, odometer and running cost.' },
  { id: 'expenses', title: 'Expense report', description: 'The complete expense ledger, including diesel, maintenance and driver payments.' },
  { id: 'vehicles', title: 'Vehicle report', description: 'Per-vehicle revenue, expenses, profit and efficiency ratios.' },
  { id: 'drivers', title: 'Driver report', description: 'Driver duty, earnings brought in, and every rupee paid out.' },
]

interface BuildContext {
  db: Database
  ledger: LedgerLine[]
  range: DateRange
  vehicleId: string | null
  today: string
}

export function buildReport(id: ReportId, ctx: BuildContext): ReportTable {
  switch (id) {
    case 'trips': return tripReport(ctx)
    case 'fuel': return fuelReport(ctx)
    case 'expenses': return expenseReport(ctx)
    case 'vehicles': return vehicleReport(ctx)
    case 'drivers': return driverReport(ctx)
  }
}

const slug = (range: DateRange, vehicle: string | null) => {
  // The all-time sentinel dates would make for a baffling filename.
  const period = range.from === '1900-01-01' ? 'all-time' : `${range.from}_to_${range.to}`
  return `${period}${vehicle ? `_${vehicle.replace(/\s+/g, '-')}` : ''}`
}

function vehicleMatches(vehicleId: string | null, target: string | null): boolean {
  return target === null || vehicleId === target
}

/* ------------------------------------------------------------------ */

function tripReport({ db, range, vehicleId }: BuildContext): ReportTable {
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name]))
  const vehicleReg = new Map(db.vehicles.map((v) => [v.id, v.registrationNumber]))
  const driverName = new Map(db.drivers.map((d) => [d.id, d.name]))

  const trips = db.trips
    .filter((t) => vehicleMatches(t.vehicleId, vehicleId) && inRange(t.date, range))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const rows = trips.map((t) => ({
    date: t.date,
    reference: t.reference,
    vehicle: vehicleName.get(t.vehicleId) ?? '—',
    registration: vehicleReg.get(t.vehicleId) ?? '—',
    driver: t.driverId ? driverName.get(t.driverId) ?? '—' : '—',
    from: t.startLocation,
    to: t.destination,
    kilometres: t.kilometres,
    tonnage: t.tonnage,
    rate: t.pricePerTon,
    freight: t.freightAmount,
    status: TRIP_STATUS_LABEL[t.status],
    notes: t.notes ?? '',
  }))

  const completed = trips.filter((t) => t.status === 'completed')
  return {
    id: 'trips',
    title: 'Trip / Workout report',
    description: `${trips.length} trips · ${completed.length} completed`,
    rows,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'reference', label: 'Trip reference' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'registration', label: 'Registration' },
      { key: 'driver', label: 'Driver' },
      { key: 'from', label: 'From' },
      { key: 'to', label: 'To' },
      { key: 'kilometres', label: 'Kilometres', numeric: true },
      { key: 'tonnage', label: 'Tonnage (t)', numeric: true, decimals: 1 },
      { key: 'rate', label: 'Rate per tonne (INR)', numeric: true },
      { key: 'freight', label: 'Freight (INR)', numeric: true },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ],
    totals: {
      date: 'Total (completed)',
      kilometres: completed.reduce((a, t) => a + t.kilometres, 0),
      tonnage: Math.round(completed.reduce((a, t) => a + t.tonnage, 0) * 10) / 10,
      freight: completed.reduce((a, t) => a + t.freightAmount, 0),
    },
    filename: `sri-ram-trips_${slug(range, vehicleId && vehicleName.get(vehicleId) ? vehicleName.get(vehicleId)! : null)}.csv`,
  }
}

/* ------------------------------------------------------------------ */

function fuelReport({ db, range, vehicleId }: BuildContext): ReportTable {
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name]))
  const driverName = new Map(db.drivers.map((d) => [d.id, d.name]))

  const entries = db.fuel
    .filter((f) => vehicleMatches(f.vehicleId, vehicleId) && inRange(f.date, range))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  // Distance since the previous fill on the same vehicle, so each row can carry
  // its own mileage instead of only a fleet average.
  const previousOdo = new Map<string, number>()
  const ascending = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))
  const distanceById = new Map<string, number | null>()
  for (const f of ascending) {
    const prev = previousOdo.get(f.vehicleId)
    distanceById.set(f.id, prev != null && f.odometer > prev ? f.odometer - prev : null)
    previousOdo.set(f.vehicleId, f.odometer)
  }

  const rows = entries.map((f) => {
    const distance = distanceById.get(f.id) ?? null
    const mileage = distance != null ? safeDiv(distance, f.litres) : null
    return {
      date: f.date,
      vehicle: vehicleName.get(f.vehicleId) ?? '—',
      driver: f.driverId ? driverName.get(f.driverId) ?? '—' : '—',
      station: f.fuelStation,
      litres: f.litres,
      rate: f.pricePerLitre,
      amount: f.totalAmount,
      odometer: f.odometer,
      distance,
      mileage: mileage != null ? Math.round(mileage * 100) / 100 : null,
      method: PAYMENT_METHOD_LABEL[f.paymentMethod],
      notes: f.notes ?? '',
    }
  })

  const totalLitres = entries.reduce((a, f) => a + f.litres, 0)
  return {
    id: 'fuel',
    title: 'Fuel report',
    description: `${entries.length} fills · ${Math.round(totalLitres).toLocaleString('en-IN')} litres`,
    rows,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'driver', label: 'Driver' },
      { key: 'station', label: 'Fuel station' },
      { key: 'litres', label: 'Litres', numeric: true, decimals: 1 },
      { key: 'rate', label: 'Rate per litre (INR)', numeric: true, decimals: 2 },
      { key: 'amount', label: 'Amount (INR)', numeric: true },
      { key: 'odometer', label: 'Odometer (km)', numeric: true },
      { key: 'distance', label: 'Distance since last fill (km)', numeric: true },
      { key: 'mileage', label: 'Mileage (km/L)', numeric: true, decimals: 2 },
      { key: 'method', label: 'Payment method' },
      { key: 'notes', label: 'Notes' },
    ],
    totals: {
      date: 'Total',
      litres: Math.round(totalLitres * 10) / 10,
      amount: entries.reduce((a, f) => a + f.totalAmount, 0),
    },
    filename: `sri-ram-fuel_${slug(range, vehicleId ? vehicleName.get(vehicleId) ?? null : null)}.csv`,
  }
}

/* ------------------------------------------------------------------ */

function expenseReport({ db, ledger, range, vehicleId }: BuildContext): ReportTable {
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name]))
  const SOURCE_LABEL: Record<LedgerLine['source'], string> = {
    fuel: 'Fuel entry', maintenance: 'Maintenance', driver: 'Driver payment', direct: 'Expense entry',
  }

  const lines = ledger
    .filter((l) => vehicleMatches(l.vehicleId, vehicleId) && inRange(l.date, range))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const rows = lines.map((l) => ({
    date: l.date,
    vehicle: l.vehicleId ? vehicleName.get(l.vehicleId) ?? '—' : 'Unallocated',
    category: CATEGORY_LABEL[l.category],
    amount: l.amount,
    description: l.description,
    method: PAYMENT_METHOD_LABEL[l.paymentMethod],
    reference: l.reference ?? '',
    source: SOURCE_LABEL[l.source],
  }))

  return {
    id: 'expenses',
    title: 'Expense report',
    description: `${lines.length} ledger lines`,
    rows,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount (INR)', numeric: true },
      { key: 'description', label: 'Description' },
      { key: 'method', label: 'Payment method' },
      { key: 'reference', label: 'Reference' },
      { key: 'source', label: 'Recorded as' },
    ],
    totals: { date: 'Total', amount: lines.reduce((a, l) => a + l.amount, 0) },
    filename: `sri-ram-expenses_${slug(range, vehicleId ? vehicleName.get(vehicleId) ?? null : null)}.csv`,
  }
}

/* ------------------------------------------------------------------ */

function vehicleReport({ db, ledger, range, vehicleId }: BuildContext): ReportTable {
  const vehicles = db.vehicles.filter((v) => vehicleMatches(v.id, vehicleId))

  const rows = vehicles.map((v) => {
    const trips = db.trips.filter((t) => t.vehicleId === v.id && inRange(t.date, range))
    const lines = ledger.filter((l) => l.vehicleId === v.id && inRange(l.date, range))
    const fuel = db.fuel.filter((f) => f.vehicleId === v.id && inRange(f.date, range))
    const s = summarise({ trips, ledger: lines, fuel })
    const driver = db.drivers.find((d) => d.assignedVehicleId === v.id)
    return {
      vehicle: v.name,
      registration: v.registrationNumber,
      type: VEHICLE_TYPE_LABEL[v.type],
      makeModel: [v.manufacturer, v.model].filter(Boolean).join(' '),
      year: v.manufacturingYear ?? '',
      fuelType: FUEL_TYPE_LABEL[v.fuelType],
      status: VEHICLE_STATUS_LABEL[v.status],
      driver: driver?.name ?? 'Unassigned',
      odometer: v.odometer,
      trips: s.trips,
      kilometres: Math.round(s.kilometres),
      tonnage: Math.round(s.tonnage * 10) / 10,
      revenue: Math.round(s.grossIncome),
      diesel: Math.round(s.byCategory.diesel),
      maintenance: Math.round(s.byCategory.service + s.byCategory.repairs + s.byCategory.tyres + s.byCategory.puncture + s.byCategory.parts),
      driverCost: Math.round(s.byCategory.driver),
      otherCost: Math.round(s.byCategory.fastag + s.byCategory.toll + s.byCategory.insurance + s.byCategory.permit + s.byCategory.other),
      expenses: Math.round(s.expenses),
      profit: Math.round(s.netProfit),
      costPerKm: round2(s.costPerKm),
      revenuePerKm: round2(s.revenuePerKm),
      profitPerKm: round2(s.profitPerKm),
      costPerTon: round2(s.costPerTon),
      mileage: round2(s.mileage),
    }
  })

  const totalOf = (key: string) => rows.reduce((a, r) => a + ((r as Record<string, CellValue>)[key] as number ?? 0), 0)

  return {
    id: 'vehicles',
    title: 'Vehicle report',
    description: `${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`,
    rows,
    columns: [
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'registration', label: 'Registration' },
      { key: 'type', label: 'Type' },
      { key: 'makeModel', label: 'Make and model' },
      { key: 'year', label: 'Year', numeric: true },
      { key: 'fuelType', label: 'Fuel type' },
      { key: 'status', label: 'Status' },
      { key: 'driver', label: 'Assigned driver' },
      { key: 'odometer', label: 'Odometer (km)', numeric: true },
      { key: 'trips', label: 'Trips', numeric: true },
      { key: 'kilometres', label: 'Kilometres', numeric: true },
      { key: 'tonnage', label: 'Tonnage (t)', numeric: true, decimals: 1 },
      { key: 'revenue', label: 'Revenue (INR)', numeric: true },
      { key: 'diesel', label: 'Diesel (INR)', numeric: true },
      { key: 'maintenance', label: 'Maintenance (INR)', numeric: true },
      { key: 'driverCost', label: 'Driver cost (INR)', numeric: true },
      { key: 'otherCost', label: 'Tolls, documents and other (INR)', numeric: true },
      { key: 'expenses', label: 'Total expenses (INR)', numeric: true },
      { key: 'profit', label: 'Net profit (INR)', numeric: true },
      { key: 'costPerKm', label: 'Cost per km (INR)', numeric: true, decimals: 2 },
      { key: 'revenuePerKm', label: 'Revenue per km (INR)', numeric: true, decimals: 2 },
      { key: 'profitPerKm', label: 'Profit per km (INR)', numeric: true, decimals: 2 },
      { key: 'costPerTon', label: 'Cost per tonne (INR)', numeric: true, decimals: 2 },
      { key: 'mileage', label: 'Mileage (km/L)', numeric: true, decimals: 2 },
    ],
    totals: {
      vehicle: 'Fleet total',
      trips: totalOf('trips'),
      kilometres: totalOf('kilometres'),
      tonnage: Math.round(totalOf('tonnage') * 10) / 10,
      revenue: totalOf('revenue'),
      diesel: totalOf('diesel'),
      maintenance: totalOf('maintenance'),
      driverCost: totalOf('driverCost'),
      otherCost: totalOf('otherCost'),
      expenses: totalOf('expenses'),
      profit: totalOf('profit'),
    },
    filename: `sri-ram-vehicles_${slug(range, null)}.csv`,
  }
}

/* ------------------------------------------------------------------ */

function driverReport({ db, range, vehicleId, today }: BuildContext): ReportTable {
  const drivers = db.drivers.filter(
    (d) => vehicleId === null || d.assignedVehicleId === vehicleId,
  )
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name]))

  const rows = drivers.map((d) => {
    const payments = db.driverPayments.filter((p) => p.driverId === d.id)
    const inWindow = payments.filter((p) => inRange(p.date, range))
    const account = driverLedger(payments, d.salary, d.joiningDate, today)
    const trips = db.trips.filter(
      (t) => t.driverId === d.id && t.status === 'completed' && inRange(t.date, range),
    )
    const paidInWindow = (type: string) =>
      inWindow.filter((p) => p.type === type).reduce((a, p) => a + p.amount, 0)

    return {
      driver: d.name,
      phone: d.phone,
      license: d.licenseNumber,
      licenseExpiry: d.licenseExpiry ?? '',
      joiningDate: d.joiningDate,
      vehicle: d.assignedVehicleId ? vehicleName.get(d.assignedVehicleId) ?? '—' : 'Unassigned',
      salary: d.salary,
      trips: trips.length,
      kilometres: trips.reduce((a, t) => a + t.kilometres, 0),
      freightEarned: trips.reduce((a, t) => a + t.freightAmount, 0),
      salaryPaid: paidInWindow('salary'),
      advances: paidInWindow('advance'),
      tripPayments: paidInWindow('trip-payment'),
      otherPaid: paidInWindow('other'),
      paidInPeriod: inWindow.reduce((a, p) => a + p.amount, 0),
      paidLifetime: account.totalPaid,
      pending: account.pending,
      notes: d.notes ?? '',
    }
  })

  const totalOf = (key: string) => rows.reduce((a, r) => a + ((r as Record<string, CellValue>)[key] as number ?? 0), 0)

  return {
    id: 'drivers',
    title: 'Driver report',
    description: `${drivers.length} ${drivers.length === 1 ? 'driver' : 'drivers'}`,
    rows,
    columns: [
      { key: 'driver', label: 'Driver' },
      { key: 'phone', label: 'Phone' },
      { key: 'license', label: 'Licence number' },
      { key: 'licenseExpiry', label: 'Licence expiry' },
      { key: 'joiningDate', label: 'Joining date' },
      { key: 'vehicle', label: 'Assigned vehicle' },
      { key: 'salary', label: 'Monthly salary (INR)', numeric: true },
      { key: 'trips', label: 'Trips in period', numeric: true },
      { key: 'kilometres', label: 'Kilometres driven', numeric: true },
      { key: 'freightEarned', label: 'Freight earned (INR)', numeric: true },
      { key: 'salaryPaid', label: 'Salary paid in period (INR)', numeric: true },
      { key: 'advances', label: 'Advances in period (INR)', numeric: true },
      { key: 'tripPayments', label: 'Trip payments in period (INR)', numeric: true },
      { key: 'otherPaid', label: 'Other payments in period (INR)', numeric: true },
      { key: 'paidInPeriod', label: 'Total paid in period (INR)', numeric: true },
      { key: 'paidLifetime', label: 'Total paid to date (INR)', numeric: true },
      { key: 'pending', label: 'Pending amount (INR)', numeric: true },
      { key: 'notes', label: 'Notes' },
    ],
    totals: {
      driver: 'Total',
      trips: totalOf('trips'),
      kilometres: totalOf('kilometres'),
      freightEarned: totalOf('freightEarned'),
      salaryPaid: totalOf('salaryPaid'),
      advances: totalOf('advances'),
      tripPayments: totalOf('tripPayments'),
      otherPaid: totalOf('otherPaid'),
      paidInPeriod: totalOf('paidInPeriod'),
      paidLifetime: totalOf('paidLifetime'),
      pending: totalOf('pending'),
    },
    filename: `sri-ram-drivers_${slug(range, null)}.csv`,
  }
}

function round2(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100
}

/* ------------------------------------------------------------------ */
/* CSV serialisation                                                   */
/* ------------------------------------------------------------------ */

/** RFC 4180: quote when the value contains a delimiter, quote or newline. */
function escapeCell(value: CellValue): string {
  if (value == null) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(table: ReportTable): string {
  const lines: string[] = []
  lines.push(table.columns.map((c) => escapeCell(c.label)).join(','))
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => escapeCell(row[c.key] ?? '')).join(','))
  }
  if (table.totals) {
    lines.push(table.columns.map((c) => escapeCell(table.totals![c.key] ?? '')).join(','))
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

export function downloadCsv(table: ReportTable): void {
  const blob = new Blob([toCsv(table)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = table.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revoked on the next frame: revoking synchronously can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
