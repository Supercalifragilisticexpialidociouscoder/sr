/**
 * Sri Ram Enterprises — core domain model.
 *
 * Seven stored entities. Everything else in the product (vehicle financials,
 * fleet totals, analytics, reports, alerts) is *derived* from these records so
 * a number can never disagree with itself between two screens.
 *
 * Money is stored in whole rupees, distances in kilometres, weight in tonnes.
 * Dates are ISO `YYYY-MM-DD` strings — the business works in days, not instants.
 */

export type VehicleType = 'tipper' | 'trailer' | 'container' | 'tanker' | 'pickup'
export type FuelType = 'diesel' | 'petrol' | 'cng' | 'electric'
export type VehicleStatus = 'active' | 'on-trip' | 'maintenance' | 'idle' | 'retired'

export interface Vehicle {
  id: string
  registrationNumber: string
  name: string
  type: VehicleType
  manufacturer: string
  model: string
  manufacturingYear: number
  fuelType: FuelType
  tankCapacity: number
  odometer: number
  status: VehicleStatus
  insuranceExpiry?: string
  permitExpiry?: string
  fitnessExpiry?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Driver {
  id: string
  name: string
  phone: string
  licenseNumber: string
  licenseExpiry: string
  joiningDate: string
  assignedVehicleId: string | null
  salary: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type TripStatus = 'completed' | 'in-transit' | 'cancelled'

export interface Trip {
  id: string
  date: string
  reference: string
  vehicleId: string
  driverId: string | null
  startLocation: string
  destination: string
  kilometres: number
  tonnage: number
  pricePerTon: number
  /** Always `tonnage × pricePerTon` unless `freightOverride` is set. */
  freightAmount: number
  /** Explicit, auditable escape hatch for a negotiated lump-sum freight. */
  freightOverride: boolean
  status: TripStatus
  notes?: string
  createdAt: string
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'fastag' | 'bank' | 'credit'

export interface FuelEntry {
  id: string
  date: string
  vehicleId: string
  driverId: string | null
  fuelStation: string
  litres: number
  pricePerLitre: number
  /** Always `litres × pricePerLitre`. */
  totalAmount: number
  odometer: number
  paymentMethod: PaymentMethod
  notes?: string
  createdAt: string
}

/**
 * Expense categories. Each one has exactly one owning record type — see
 * `CATEGORY_SOURCE` below. That mapping is what makes double counting
 * structurally impossible rather than a rule people have to remember.
 */
export type ExpenseCategory =
  | 'diesel' | 'tyres' | 'puncture' | 'service' | 'repairs' | 'fastag'
  | 'driver' | 'insurance' | 'permit' | 'toll' | 'parts' | 'other'

/** A directly-entered expense. Never carries a category owned by another ledger. */
export interface Expense {
  id: string
  date: string
  vehicleId: string | null
  category: ExpenseCategory
  amount: number
  description: string
  paymentMethod: PaymentMethod
  reference?: string
  createdAt: string
}

export type MaintenanceType = 'service' | 'oil-change' | 'tyres' | 'puncture' | 'repairs' | 'parts'

export interface Maintenance {
  id: string
  date: string
  vehicleId: string
  type: MaintenanceType
  cost: number
  odometer: number
  description: string
  nextServiceDue?: string
  createdAt: string
}

export type DriverPaymentType = 'salary' | 'advance' | 'trip-payment' | 'other'

export interface DriverPayment {
  id: string
  driverId: string
  date: string
  type: DriverPaymentType
  amount: number
  notes?: string
  createdAt: string
}

export interface Database {
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  maintenance: Maintenance[]
  driverPayments: DriverPayment[]
}

/* ------------------------------------------------------------------ */
/* Accounting: which record type owns each expense category            */
/* ------------------------------------------------------------------ */

export type LedgerSource = 'fuel' | 'maintenance' | 'driver' | 'direct'

/**
 * The single accounting authority. Every rupee of expense enters the ledger
 * through exactly one of these sources, so a diesel fill logged as a fuel entry
 * can never also be typed in as a "diesel" expense — the Add Expense form does
 * not offer categories owned by another ledger, and routes the user instead.
 */
export const CATEGORY_SOURCE: Record<ExpenseCategory, LedgerSource> = {
  diesel: 'fuel',
  service: 'maintenance',
  tyres: 'maintenance',
  puncture: 'maintenance',
  repairs: 'maintenance',
  parts: 'maintenance',
  driver: 'driver',
  fastag: 'direct',
  insurance: 'direct',
  permit: 'direct',
  toll: 'direct',
  other: 'direct',
}

/** Categories a user may pick in the Add Expense form. */
export const DIRECT_CATEGORIES = (Object.keys(CATEGORY_SOURCE) as ExpenseCategory[])
  .filter((c) => CATEGORY_SOURCE[c] === 'direct')

export const MAINTENANCE_CATEGORY: Record<MaintenanceType, ExpenseCategory> = {
  service: 'service',
  'oil-change': 'service',
  tyres: 'tyres',
  puncture: 'puncture',
  repairs: 'repairs',
  parts: 'parts',
}

/**
 * One normalised expense line. Produced by the selector layer from fuel,
 * maintenance, driver payments and direct expenses — never stored, so it can
 * never drift from the records it summarises.
 */
export interface LedgerLine {
  id: string
  date: string
  vehicleId: string | null
  driverId?: string | null
  category: ExpenseCategory
  amount: number
  description: string
  paymentMethod: PaymentMethod
  reference?: string
  source: LedgerSource
  sourceId: string
}

/* ------------------------------------------------------------------ */
/* Display labels                                                      */
/* ------------------------------------------------------------------ */

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  tipper: 'Tipper', trailer: 'Trailer', container: 'Container',
  tanker: 'Tanker', pickup: 'Pickup',
}

export const FUEL_TYPE_LABEL: Record<FuelType, string> = {
  diesel: 'Diesel', petrol: 'Petrol', cng: 'CNG', electric: 'Electric',
}

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  active: 'Active', 'on-trip': 'On trip', maintenance: 'In maintenance',
  idle: 'Idle', retired: 'Retired',
}

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  completed: 'Completed', 'in-transit': 'In transit', cancelled: 'Cancelled',
}

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  diesel: 'Diesel', tyres: 'Tyres', puncture: 'Puncture', service: 'Service',
  repairs: 'Repairs', fastag: 'FASTag', driver: 'Driver payment',
  insurance: 'Insurance', permit: 'Permit / documents', toll: 'Toll',
  parts: 'Parts', other: 'Other',
}

export const MAINTENANCE_TYPE_LABEL: Record<MaintenanceType, string> = {
  service: 'Service', 'oil-change': 'Oil change', tyres: 'Tyres',
  puncture: 'Puncture', repairs: 'Repairs', parts: 'Parts replacement',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', fastag: 'FASTag',
  bank: 'Bank transfer', credit: 'Credit',
}

export const DRIVER_PAYMENT_LABEL: Record<DriverPaymentType, string> = {
  salary: 'Salary paid', advance: 'Advance given',
  'trip-payment': 'Trip payment', other: 'Other payment',
}
