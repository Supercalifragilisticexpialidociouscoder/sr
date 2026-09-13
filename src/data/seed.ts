/**
 * Demo data for Sri Ram Enterprises.
 *
 * Generated deterministically (fixed-seed PRNG) rather than hand-typed, because
 * the numbers have to reconcile: odometer readings advance by exactly the trip
 * kilometres logged against them, fuel fills are sized from distance actually
 * covered, and services fall on realistic service intervals. Hand-written demo
 * data drifts out of agreement the moment anyone looks closely.
 *
 * Dates are generated relative to "today" so the week / month / year filters
 * always have something to show.
 */

import type {
  Database, Driver, DriverPayment, Expense, FuelEntry, Maintenance, Trip, Vehicle,
} from './types'
import { tripFreight, fuelCost } from './calc'
import { addDays, fromISO, toISO } from './format'

/** mulberry32 — small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MONTHS_BACK = 9

interface RouteDef {
  from: string
  to: string
  km: number
}

/** Routes worked out of the Coimbatore–Erode belt. */
const TIPPER_ROUTES: RouteDef[] = [
  { from: 'Coimbatore', to: 'Salem', km: 168 },
  { from: 'Erode', to: 'Karur', km: 64 },
  { from: 'Coimbatore', to: 'Tiruppur', km: 52 },
  { from: 'Salem', to: 'Namakkal', km: 54 },
  { from: 'Coimbatore', to: 'Pollachi', km: 45 },
  { from: 'Erode', to: 'Bhavani', km: 28 },
  { from: 'Karur', to: 'Dindigul', km: 98 },
]

const TRAILER_ROUTES: RouteDef[] = [
  { from: 'Coimbatore', to: 'Chennai', km: 508 },
  { from: 'Erode', to: 'Bengaluru', km: 296 },
  { from: 'Tiruppur', to: 'Hyderabad', km: 782 },
  { from: 'Coimbatore', to: 'Kochi', km: 192 },
  { from: 'Salem', to: 'Chennai', km: 342 },
  { from: 'Coimbatore', to: 'Mangaluru', km: 428 },
]

const CONTAINER_ROUTES: RouteDef[] = [
  { from: 'Tiruppur', to: 'Chennai Port', km: 528 },
  { from: 'Coimbatore', to: 'Bengaluru', km: 364 },
  { from: 'Erode', to: 'Chennai', km: 398 },
  { from: 'Tiruppur', to: 'Kochi', km: 216 },
  { from: 'Coimbatore', to: 'Madurai', km: 216 },
]

const FUEL_STATIONS = [
  'IOC Avinashi Road', 'HP Sathy Road', 'BPCL Mettupalayam',
  'IOC Salem Bypass', 'Shell Krishnagiri', 'HP Perundurai',
]

interface VehicleSpec {
  vehicle: Omit<Vehicle, 'createdAt' | 'updatedAt' | 'odometer'>
  startOdometer: number
  routes: RouteDef[]
  tripsPerMonth: [number, number]
  tonnage: [number, number]
  ratePerTon: [number, number]
  mileage: number
  serviceIntervalKm: number
  /** Days until the next service falls due, matched to how hard this class works. */
  serviceIntervalDays: number
  tyreIntervalKm: number
}

const SPECS: VehicleSpec[] = [
  {
    vehicle: {
      id: 'v1',
      registrationNumber: 'TN 38 AQ 4521',
      name: 'SRE-01',
      type: 'tipper',
      manufacturer: 'Tata Motors',
      model: 'Signa 2823.K',
      manufacturingYear: 2021,
      fuelType: 'diesel',
      tankCapacity: 300,
      status: 'active',
      insuranceExpiry: '',
      permitExpiry: '',
      fitnessExpiry: '',
      notes: 'M-sand and blue metal haulage for the Coimbatore quarry contract. Tipper body rebuilt in 2024.',
    },
    startOdometer: 214_500,
    routes: TIPPER_ROUTES,
    tripsPerMonth: [16, 24],
    tonnage: [14, 22],
    ratePerTon: [250, 460],
    mileage: 3.4,
    serviceIntervalKm: 12_000,
    serviceIntervalDays: 270,
    tyreIntervalKm: 52_000,
  },
  {
    vehicle: {
      id: 'v2',
      registrationNumber: 'TN 45 BH 7788',
      name: 'SRE-02',
      type: 'trailer',
      manufacturer: 'Ashok Leyland',
      model: '3520 IL',
      manufacturingYear: 2019,
      fuelType: 'diesel',
      tankCapacity: 365,
      status: 'on-trip',
      insuranceExpiry: '',
      permitExpiry: '',
      fitnessExpiry: '',
      notes: 'Long-haul textile and machinery movement. National permit, runs Chennai and Hyderabad corridors.',
    },
    startOdometer: 388_200,
    routes: TRAILER_ROUTES,
    tripsPerMonth: [4, 7],
    tonnage: [18, 28],
    ratePerTon: [1_650, 2_450],
    mileage: 2.9,
    serviceIntervalKm: 15_000,
    serviceIntervalDays: 115,
    tyreIntervalKm: 58_000,
  },
  {
    vehicle: {
      id: 'v3',
      registrationNumber: 'TN 52 CK 1109',
      name: 'SRE-03',
      type: 'container',
      manufacturer: 'BharatBenz',
      model: '1917R',
      manufacturingYear: 2022,
      fuelType: 'diesel',
      tankCapacity: 275,
      status: 'maintenance',
      insuranceExpiry: '',
      permitExpiry: '',
      fitnessExpiry: '',
      notes: 'Container movement to Chennai Port for the Tiruppur knitwear exporters. Gearbox overhaul in progress.',
    },
    startOdometer: 141_800,
    routes: CONTAINER_ROUTES,
    tripsPerMonth: [5, 8],
    tonnage: [11, 17],
    ratePerTon: [1_750, 2_450],
    mileage: 3.8,
    serviceIntervalKm: 14_000,
    serviceIntervalDays: 110,
    tyreIntervalKm: 62_000,
  },
]

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)]
}

function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min)
}

function intBetween(r: () => number, min: number, max: number): number {
  return Math.floor(between(r, min, max + 1))
}

/** Diesel drifts realistically across the period instead of sitting flat. */
function dieselPrice(r: () => number, monthIndex: number): number {
  return Math.round((92.4 + monthIndex * 0.42 + between(r, -0.9, 0.9)) * 100) / 100
}

export function createSeedDatabase(today: string): Database {
  const r = rng(20_260_913)
  const now = fromISO(today)
  const stamp = `${today}T09:00:00.000Z`

  const vehicles: Vehicle[] = []
  const trips: Trip[] = []
  const fuel: FuelEntry[] = []
  const expenses: Expense[] = []
  const maintenance: Maintenance[] = []

  const drivers: Driver[] = [
    {
      id: 'd1', name: 'Murugan S', phone: '+91 98430 11245',
      licenseNumber: 'TN38 20150004521', licenseExpiry: addDays(today, 38),
      joiningDate: toISO(new Date(now.getFullYear() - 4, 1, 12)),
      assignedVehicleId: 'v1', salary: 24_000,
      notes: 'Quarry routes. Holds hazardous endorsement.',
      createdAt: stamp, updatedAt: stamp,
    },
    {
      id: 'd2', name: 'Rajesh Kumar M', phone: '+91 94422 67310',
      licenseNumber: 'TN45 20170008814', licenseExpiry: addDays(today, 410),
      joiningDate: toISO(new Date(now.getFullYear() - 6, 6, 3)),
      assignedVehicleId: 'v2', salary: 27_500,
      notes: 'Senior long-haul driver. Handles Hyderabad and Chennai corridors.',
      createdAt: stamp, updatedAt: stamp,
    },
    {
      id: 'd3', name: 'Anbu Selvan R', phone: '+91 99529 84077',
      licenseNumber: 'TN52 20190002267', licenseExpiry: addDays(today, 221),
      joiningDate: toISO(new Date(now.getFullYear() - 2, 9, 21)),
      assignedVehicleId: 'v3', salary: 23_000,
      notes: 'Port container runs. Familiar with Chennai Port documentation.',
      createdAt: stamp, updatedAt: stamp,
    },
    {
      id: 'd4', name: 'Karthik V', phone: '+91 90031 45529',
      licenseNumber: 'TN37 20210006630', licenseExpiry: addDays(today, -9),
      joiningDate: toISO(new Date(now.getFullYear() - 1, 3, 8)),
      assignedVehicleId: null, salary: 21_000,
      notes: 'Relief driver. Licence renewal submitted at Erode RTO.',
      createdAt: stamp, updatedAt: stamp,
    },
  ]

  const driverPayments: DriverPayment[] = []
  let seq = 0
  const id = (prefix: string) => `${prefix}${(++seq).toString(36).padStart(4, '0')}`

  const periodStart = new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK + 1, 1)

  for (const spec of SPECS) {
    let odometer = spec.startOdometer
    let odoAtLastFill = spec.startOdometer
    let odoAtLastService = spec.startOdometer - intBetween(r, 2_000, 9_000)
    let odoAtLastTyres = spec.startOdometer - intBetween(r, 5_000, 40_000)
    const driver = drivers.find((d) => d.assignedVehicleId === spec.vehicle.id) ?? null
    let tripNo = intBetween(r, 120, 260)

    for (let m = 0; m < MONTHS_BACK; m++) {
      const monthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() + m, 1)
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
      const lastDay = Math.min(monthEnd.getDate(), monthStart.getMonth() === now.getMonth() && monthStart.getFullYear() === now.getFullYear() ? now.getDate() : monthEnd.getDate())
      if (lastDay < 1) continue

      // SRE-03 loses most of the current month to the gearbox overhaul.
      const isCurrentMonth = monthStart.getMonth() === now.getMonth() && monthStart.getFullYear() === now.getFullYear()
      const downtime = spec.vehicle.id === 'v3' && isCurrentMonth
      const tripCount = downtime
        ? Math.max(1, Math.round(intBetween(r, ...spec.tripsPerMonth) * 0.3))
        : Math.round((intBetween(r, ...spec.tripsPerMonth) * lastDay) / monthEnd.getDate())

      const days = new Set<number>()
      while (days.size < tripCount && days.size < lastDay) days.add(intBetween(r, 1, lastDay))
      const tripDays = [...days].sort((a, b) => a - b)

      for (const day of tripDays) {
        const iso = toISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
        const route = pick(r, spec.routes)
        // Long-haul vehicles run there and back; a tipper shuttles one way.
        const laden = spec.vehicle.type === 'tipper' ? 1 : 1.9
        const kilometres = Math.round(route.km * laden * between(r, 0.96, 1.06))
        const tonnage = Math.round(between(r, ...spec.tonnage) * 2) / 2
        const pricePerTon = Math.round(between(r, ...spec.ratePerTon) / 10) * 10
        tripNo += 1

        const daysAgo = Math.round((now.getTime() - fromISO(iso).getTime()) / 86_400_000)
        const status: Trip['status'] =
          daysAgo <= 1 && spec.vehicle.status === 'on-trip' ? 'in-transit'
            : r() < 0.02 ? 'cancelled' : 'completed'

        trips.push({
          id: id('t'),
          date: iso,
          reference: `SRE/${String(monthStart.getFullYear()).slice(2)}/${String(tripNo).padStart(4, '0')}`,
          vehicleId: spec.vehicle.id,
          driverId: driver?.id ?? null,
          startLocation: route.from,
          destination: route.to,
          kilometres,
          tonnage,
          pricePerTon,
          freightAmount: tripFreight(tonnage, pricePerTon),
          freightOverride: false,
          status,
          notes: status === 'cancelled' ? 'Consignor cancelled — load not tendered.' : undefined,
          createdAt: `${iso}T18:30:00.000Z`,
        })

        // A cancelled load never moved, so it burns no diesel, batta or toll.
        if (status === 'cancelled') continue

        odometer += kilometres

        if (driver) {
          driverPayments.push({
            id: id('dp'),
            driverId: driver.id,
            date: iso,
            type: 'trip-payment',
            amount: spec.vehicle.type === 'tipper' ? 400 : 900,
            notes: `Batta · ${route.from} – ${route.to}`,
            createdAt: `${iso}T18:40:00.000Z`,
          })
        }

        // Refuel once the tank would realistically be down to its last quarter.
        const sinceFill = odometer - odoAtLastFill
        if (sinceFill >= spec.vehicle.tankCapacity * spec.mileage * 0.72) {
          const litresFilled = Math.round((sinceFill / spec.mileage) * between(r, 0.97, 1.04))
          const pricePerLitre = dieselPrice(r, m)
          fuel.push({
            id: id('f'),
            date: iso,
            vehicleId: spec.vehicle.id,
            driverId: driver?.id ?? null,
            fuelStation: pick(r, FUEL_STATIONS),
            litres: litresFilled,
            pricePerLitre,
            totalAmount: fuelCost(litresFilled, pricePerLitre),
            odometer,
            paymentMethod: r() < 0.55 ? 'card' : r() < 0.6 ? 'cash' : 'credit',
            notes: undefined,
            createdAt: `${iso}T12:00:00.000Z`,
          })
          odoAtLastFill = odometer
        }

        // Scheduled service, on the odometer interval.
        if (odometer - odoAtLastService >= spec.serviceIntervalKm) {
          const cost = Math.round(between(r, 11_000, 19_500) / 50) * 50
          maintenance.push({
            id: id('m'),
            date: iso,
            vehicleId: spec.vehicle.id,
            type: 'service',
            cost,
            odometer,
            description: 'Periodic service — engine oil, filters, greasing, brake inspection',
            nextServiceDue: addDays(iso, spec.serviceIntervalDays),
            createdAt: `${iso}T16:00:00.000Z`,
          })
          odoAtLastService = odometer
        }

        // Tyres wear by distance, not by how often the truck leaves the yard.
        if (odometer - odoAtLastTyres >= spec.tyreIntervalKm) {
          const count = intBetween(r, 2, 4)
          maintenance.push({
            id: id('m'), date: iso, vehicleId: spec.vehicle.id, type: 'tyres',
            cost: count * Math.round(between(r, 17_500, 23_000) / 100) * 100, odometer,
            description: `${count} × 10.00 R20 tyres replaced`,
            createdAt: `${iso}T15:10:00.000Z`,
          })
          odoAtLastTyres = odometer
        }

        // Unplanned breakdowns scale with the distance covered on the leg.
        const wear = Math.min(2.4, kilometres / 450)
        const roll = r()
        if (roll < 0.055 * wear) {
          maintenance.push({
            id: id('m'), date: iso, vehicleId: spec.vehicle.id, type: 'puncture',
            cost: Math.round(between(r, 350, 1_400) / 50) * 50, odometer,
            description: `Tyre puncture repaired en route to ${route.to}`,
            createdAt: `${iso}T15:10:00.000Z`,
          })
        } else if (roll < 0.095 * wear) {
          maintenance.push({
            id: id('m'), date: iso, vehicleId: spec.vehicle.id, type: 'repairs',
            cost: Math.round(between(r, 3_200, 26_000) / 100) * 100, odometer,
            description: pick(r, [
              'Air brake chamber replaced', 'Radiator hose and coolant top-up',
              'Suspension leaf spring welded', 'Self-starter motor rewound',
              'Clutch plate assembly replaced',
            ]),
            createdAt: `${iso}T15:10:00.000Z`,
          })
        }

        // Tolls: FASTag on the highway corridors, cash at the local check posts.
        if (route.km > 150) {
          expenses.push({
            id: id('e'), date: iso, vehicleId: spec.vehicle.id, category: 'fastag',
            amount: Math.round(between(r, 900, 3_400) / 10) * 10,
            description: `FASTag recharge — ${route.from} – ${route.to} corridor`,
            paymentMethod: 'upi',
            reference: `FT${intBetween(r, 100000, 999999)}`,
            createdAt: `${iso}T08:15:00.000Z`,
          })
        } else if (r() < 0.3) {
          expenses.push({
            id: id('e'), date: iso, vehicleId: spec.vehicle.id, category: 'toll',
            amount: Math.round(between(r, 120, 480) / 10) * 10,
            description: `Cash toll — ${route.to} check post`,
            paymentMethod: 'cash',
            createdAt: `${iso}T08:15:00.000Z`,
          })
        }

        if (r() < 0.16) {
          expenses.push({
            id: id('e'), date: iso, vehicleId: spec.vehicle.id, category: 'other',
            amount: Math.round(between(r, 250, 2_600) / 10) * 10,
            description: pick(r, [
              'Loading and unloading charges', 'Weighbridge charges',
              'Parking at destination yard', 'Tarpaulin and rope replacement',
              'Driver lodging on overnight halt',
            ]),
            paymentMethod: r() < 0.7 ? 'cash' : 'upi',
            createdAt: `${iso}T20:00:00.000Z`,
          })
        }
      }

      // Salary is settled at the end of each completed month, for that month.
      // The current month is not paid until it is over, so a mid-month view
      // shows no phantom arrears.
      if (driver && !isCurrentMonth) {
        const payDay = toISO(monthEnd)
        // Anbu's August salary is deliberately left unpaid, so the product has
        // a genuine outstanding balance to show rather than an all-clear.
        const withheld = driver.id === 'd3'
          && monthStart.getMonth() === (now.getMonth() + 11) % 12
        if (payDay <= today && !withheld) {
          driverPayments.push({
            id: id('dp'), driverId: driver.id, date: payDay, type: 'salary',
            amount: driver.salary,
            notes: `Salary for ${monthStart.toLocaleString('en-IN', { month: 'long' })}`,
            createdAt: `${payDay}T11:00:00.000Z`,
          })
        }
      }
    }

    // Annual paperwork, priced by vehicle class.
    const insuranceDate = addDays(today, -intBetween(r, 40, 300))
    expenses.push({
      id: id('e'), date: insuranceDate, vehicleId: spec.vehicle.id, category: 'insurance',
      amount: Math.round(between(r, 42_000, 78_000) / 100) * 100,
      description: 'Comprehensive goods-carriage policy — annual premium',
      paymentMethod: 'bank',
      reference: `POL/${intBetween(r, 100000, 999999)}`,
      createdAt: `${insuranceDate}T10:00:00.000Z`,
    })
    const permitDate = addDays(today, -intBetween(r, 20, 240))
    expenses.push({
      id: id('e'), date: permitDate, vehicleId: spec.vehicle.id, category: 'permit',
      amount: Math.round(between(r, 6_500, 24_000) / 100) * 100,
      description: spec.vehicle.type === 'tipper' ? 'State permit and road tax renewal' : 'National permit renewal and authorisation',
      paymentMethod: 'bank',
      createdAt: `${permitDate}T10:00:00.000Z`,
    })

    vehicles.push({
      ...spec.vehicle,
      odometer,
      insuranceExpiry: addDays(insuranceDate, 365),
      permitExpiry: addDays(permitDate, 365),
      fitnessExpiry: addDays(today, intBetween(r, 25, 520)),
      createdAt: stamp,
      updatedAt: stamp,
    })
  }

  // A couple of advances against salary, the way they actually get taken.
  driverPayments.push({
    id: id('dp'), driverId: 'd1', date: addDays(today, -23), type: 'advance',
    amount: 8_000, notes: 'Advance for family medical expense',
    createdAt: `${addDays(today, -23)}T10:00:00.000Z`,
  })
  driverPayments.push({
    id: id('dp'), driverId: 'd2', date: addDays(today, -51), type: 'advance',
    amount: 15_000, notes: 'Advance against Deepavali bonus',
    createdAt: `${addDays(today, -51)}T10:00:00.000Z`,
  })
  driverPayments.push({
    id: id('dp'), driverId: 'd4', date: addDays(today, -12), type: 'other',
    amount: 3_500, notes: 'Relief duty — 4 days covering SRE-02',
    createdAt: `${addDays(today, -12)}T10:00:00.000Z`,
  })

  // SRE-03 is off the road right now for a gearbox overhaul.
  const overhaulDate = addDays(today, -6)
  maintenance.push({
    id: id('m'), date: overhaulDate, vehicleId: 'v3', type: 'repairs',
    cost: 86_400,
    odometer: vehicles.find((v) => v.id === 'v3')?.odometer ?? 0,
    description: 'Gearbox overhaul — layshaft bearing and synchro replacement at authorised workshop',
    nextServiceDue: addDays(today, 4),
    createdAt: `${overhaulDate}T14:00:00.000Z`,
  })

  return {
    vehicles,
    drivers,
    trips: trips.sort((a, b) => (a.date < b.date ? 1 : -1)),
    fuel: fuel.sort((a, b) => (a.date < b.date ? 1 : -1)),
    expenses: expenses.sort((a, b) => (a.date < b.date ? 1 : -1)),
    maintenance: maintenance.sort((a, b) => (a.date < b.date ? 1 : -1)),
    driverPayments: driverPayments.sort((a, b) => (a.date < b.date ? 1 : -1)),
  }
}

export const EMPTY_DATABASE: Database = {
  vehicles: [], drivers: [], trips: [], fuel: [],
  expenses: [], maintenance: [], driverPayments: [],
}
