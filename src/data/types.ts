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

export type VehicleType =
  | '6-wheeler' | '10-wheeler' | '12-wheeler' | '14-wheeler' | '16-wheeler' | '18-wheeler'
  | 'tipper' | 'trailer' | 'container' | 'tanker' | 'pickup'
export type FuelType = 'diesel' | 'petrol' | 'cng' | 'electric'
export type VehicleStatus = 'active' | 'on-trip' | 'maintenance' | 'idle' | 'retired'

export interface Vehicle extends Sourced {
  id: string
  registrationNumber: string
  name: string
  type: VehicleType
  manufacturer?: string
  model?: string
  manufacturingYear?: number
  fuelType: FuelType
  /** 0 when the tank size has not been recorded. */
  tankCapacity: number
  /** 0 when no reading has been taken yet. */
  odometer: number
  status: VehicleStatus
  insuranceExpiry?: string
  permitExpiry?: string
  fitnessExpiry?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Driver extends Sourced {
  id: string
  name: string
  phone: string
  licenseNumber: string
  /** Optional: plenty of offices hold the licence without noting its expiry. */
  licenseExpiry?: string
  joiningDate: string
  assignedVehicleId: string | null
  salary: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type TripStatus = 'completed' | 'in-transit' | 'cancelled'

export interface Trip extends Sourced {
  id: string
  date: string
  /** May be blank — not every trip is given a number. */
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

/** Diesel and AdBlue are both bought by the litre at a pump, so they share a
 *  record shape. The product decides which expense category they post to. */
export type FuelProduct = 'diesel' | 'adblue'

export interface FuelEntry extends Sourced {
  id: string
  date: string
  product: FuelProduct
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
  | 'diesel' | 'adblue' | 'fastag' | 'toll' | 'driver' | 'service'
  | 'tyres' | 'puncture' | 'repairs' | 'parts' | 'insurance' | 'documents' | 'other'

/** A directly-entered expense. Never carries a category owned by another ledger. */
export interface Expense extends Sourced {
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

export interface Maintenance extends Sourced {
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

export interface DriverPayment extends Sourced {
  id: string
  driverId: string
  date: string
  type: DriverPaymentType
  amount: number
  notes?: string
  createdAt: string
}

/**
 * Where a record came from.
 *
 * Kept on every record so an imported figure can always be traced back to the
 * file it arrived in, and so imported data is never silently mixed with
 * anything entered by hand.
 */
export interface Sourced {
  importId?: string
}

export type SheetKind =
  | 'trips' | 'fuel' | 'adblue' | 'expenses' | 'maintenance'
  | 'vehicles' | 'drivers' | 'driver-payments' | 'unknown'

export interface ImportIssue {
  sheet: string
  row: number
  problem: string
  suggestion?: string
  /** The offending row, for display on the review screen. */
  values: (string | number | null)[]
}

export interface ImportSheetSummary {
  name: string
  kind: SheetKind
  /** 0–1: how confident the classifier is about `kind`. */
  confidence: number
  rowsRead: number
  imported: number
  skipped: number
  duplicates: number
}

/** One upload. Records created by it carry its id in `importId`. */
export interface ImportBatch {
  id: string
  fileName: string
  importedAt: string
  sheets: ImportSheetSummary[]
  counts: Record<string, number>
  issues: ImportIssue[]
  /** Fingerprint of the workbook's headers, so the mapping can be reused. */
  signature: string
}

export interface Database {
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  fuel: FuelEntry[]
  expenses: Expense[]
  maintenance: Maintenance[]
  driverPayments: DriverPayment[]
  imports: ImportBatch[]
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
  adblue: 'fuel',
  service: 'maintenance',
  tyres: 'maintenance',
  puncture: 'maintenance',
  repairs: 'maintenance',
  parts: 'maintenance',
  driver: 'driver',
  fastag: 'direct',
  toll: 'direct',
  insurance: 'direct',
  documents: 'direct',
  other: 'direct',
}

/** Expense categories in the order the business thinks about them. */
export const CATEGORY_ORDER: ExpenseCategory[] = [
  'diesel', 'adblue', 'fastag', 'toll', 'driver', 'service',
  'tyres', 'puncture', 'repairs', 'parts', 'insurance', 'documents', 'other',
]

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
  '6-wheeler': '6-Wheeler', '10-wheeler': '10-Wheeler', '12-wheeler': '12-Wheeler',
  '14-wheeler': '14-Wheeler', '16-wheeler': '16-Wheeler', '18-wheeler': '18-Wheeler',
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
  diesel: 'Diesel', adblue: 'AdBlue', fastag: 'FASTag', toll: 'Toll',
  driver: 'Driver', service: 'Maintenance', tyres: 'Tyres',
  puncture: 'Puncture', repairs: 'Repairs', parts: 'Parts',
  insurance: 'Insurance', documents: 'Documents', other: 'Other',
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
