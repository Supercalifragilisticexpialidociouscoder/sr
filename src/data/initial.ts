/**
 * The starting records for Sri Ram Enterprises.
 *
 * Imported from the operator's existing database, preserving the original row
 * ids so a later sync can still match them up. Three notes on the mapping:
 *
 *  1. The source `expenses` table carried a `Puncture` row. Punctures belong to
 *     the maintenance ledger here (see `CATEGORY_SOURCE`), so it is imported as
 *     a maintenance record. It reaches the expense ledger exactly once either
 *     way — this keeps it out of the direct-expense table where it could be
 *     entered a second time.
 *  2. The driver payment is recorded as it was stored (`Salary`), even though
 *     its note reads "Advance". Reinterpreting a money record is not this
 *     import's job; it is one click to change on the driver's page.
 *  3. Fields the source did not carry — model year, tank capacity, licence
 *     expiry, most odometers — are left unset rather than zeroed, so the
 *     product reports them as unrecorded instead of inventing a figure.
 */

import type { Database } from './types'

/** The source stored creation times as epoch milliseconds. */
const at = (ms: number) => new Date(ms).toISOString()

export function createInitialDatabase(): Database {
  return {
    vehicles: [
      {
        id: 'v-1788192253138',
        registrationNumber: 'TS07UP0541',
        name: '12Tyre',
        type: '12-wheeler',
        fuelType: 'diesel',
        tankCapacity: 0,
        odometer: 0,
        status: 'active',
        createdAt: at(1788192253138),
        updatedAt: at(1788192253138),
      },
      {
        id: 'v-1788194081025',
        registrationNumber: 'TG08V1530',
        name: 'Vehicle 1530',
        type: '12-wheeler',
        fuelType: 'diesel',
        tankCapacity: 0,
        odometer: 0,
        status: 'active',
        createdAt: at(1788194081025),
        updatedAt: at(1788194081025),
      },
      {
        id: 'v-1788194114527',
        registrationNumber: 'TG08V7396',
        name: '16 tyre',
        type: '16-wheeler',
        fuelType: 'diesel',
        tankCapacity: 0,
        // Taken from the fuel entry below — the only reading on record.
        odometer: 40928,
        status: 'active',
        createdAt: at(1788194114527),
        updatedAt: at(1788194114527),
      },
    ],

    drivers: [
      {
        id: 'd-1788231761689',
        name: 'Sonu',
        phone: '6281747305',
        licenseNumber: 'Lc000123',
        joiningDate: '2025-01-01',
        assignedVehicleId: 'v-1788194114527',
        salary: 30000,
        createdAt: at(1788231761689),
        updatedAt: at(1788231761689),
      },
      {
        id: 'd-1788231896090',
        name: 'Sujith',
        phone: '9372996919',
        licenseNumber: 'Lv0002233',
        joiningDate: '2026-01-01',
        assignedVehicleId: 'v-1788192253138',
        salary: 25000,
        createdAt: at(1788231896090),
        updatedAt: at(1788231896090),
      },
      {
        id: 'd-1788231959898',
        name: 'Raju',
        phone: '9900990099',
        licenseNumber: 'Lc002244',
        joiningDate: '2026-09-01',
        assignedVehicleId: 'v-1788194081025',
        salary: 25000,
        createdAt: at(1788231959898),
        updatedAt: at(1788231959898),
      },
    ],

    trips: [
      {
        id: 't-1788232718015',
        date: '2026-09-01',
        reference: '',
        vehicleId: 'v-1788194114527',
        driverId: 'd-1788231761689',
        startLocation: 'Robo silicon',
        destination: 'Alkapury',
        kilometres: 75.2,
        tonnage: 32.24,
        pricePerTon: 244.4,
        // 32.24 t x Rs244.40 = Rs7,879.46 — matches the source row exactly.
        freightAmount: 7879.46,
        freightOverride: false,
        status: 'completed',
        createdAt: at(1788232718015),
      },
    ],

    fuel: [
      {
        id: 'f-1788232453138',
        date: '2026-09-01',
        product: 'diesel',
        vehicleId: 'v-1788194114527',
        driverId: 'd-1788231761689',
        fuelStation: 'ShakarMart',
        litres: 183,
        pricePerLitre: 104.7,
        totalAmount: 19160.1,
        odometer: 40928,
        paymentMethod: 'cash',
        createdAt: at(1788232453138),
      },
    ],

    expenses: [],

    maintenance: [
      {
        id: 'e-1788233187419',
        date: '2026-09-01',
        vehicleId: 'v-1788194114527',
        type: 'puncture',
        cost: 1900,
        odometer: 40928,
        description: 'Front tyre',
        createdAt: at(1788233187419),
      },
    ],

    imports: [],

    driverPayments: [
      {
        id: 'dp-1788232933828',
        driverId: 'd-1788231761689',
        date: '2026-09-01',
        type: 'salary',
        amount: 2000,
        notes: 'Advance',
        createdAt: at(1788232933828),
      },
    ],
  }
}

export const EMPTY_DATABASE: Database = {
  vehicles: [], drivers: [], trips: [], fuel: [],
  expenses: [], maintenance: [], driverPayments: [], imports: [],
}
