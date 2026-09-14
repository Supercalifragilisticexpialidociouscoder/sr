/**
 * What the columns of a transport workbook are called.
 *
 * No two companies name their columns the same way, and the same company
 * renames them between months. Rather than demanding a fixed template, each
 * canonical field carries the spellings it is actually seen under, and the
 * importer scores every header against them.
 *
 * `signal` marks a field as *distinctive* of its sheet: plenty of sheets have a
 * date, a vehicle and an amount, but only a fuel sheet has litres, and only an
 * expense sheet has a head of expenditure. Those are what separate one kind of
 * sheet from another.
 */

import type { SheetKind } from '../types'
import { key, type Cell } from './normalize'

export type FieldKind = 'date' | 'number' | 'text' | 'vehicle' | 'driver' | 'category'

export interface FieldDef {
  id: string
  label: string
  kind: FieldKind
  /** Spellings seen in the wild. Compared after case and punctuation are removed. */
  synonyms: string[]
  /** The row is unusable without it. */
  required?: boolean
  /** Weight when deciding what kind of sheet this is. */
  signal?: number
}

export interface SheetSchema {
  kind: SheetKind
  label: string
  /** Words in the sheet's tab name that point at this kind. */
  nameHints: string[]
  fields: FieldDef[]
}

const DATE: FieldDef = {
  id: 'date', label: 'Date', kind: 'date', required: true,
  synonyms: ['date', 'dt', 'transactiondate', 'entrydate', 'billdate', 'tripdate',
    'loadingdate', 'invoicedate', 'expensedate', 'paymentdate', 'day'],
}

const VEHICLE: FieldDef = {
  id: 'vehicle', label: 'Vehicle', kind: 'vehicle', required: true,
  synonyms: ['vehicle', 'vehicleno', 'vehiclenumber', 'vehiclereg', 'vehicleregno',
    'truck', 'truckno', 'trucknumber', 'lorry', 'lorryno', 'regno', 'registration',
    'registrationno', 'registrationnumber', 'number', 'vehicleid', 'tno', 'vno'],
}

const DRIVER: FieldDef = {
  id: 'driver', label: 'Driver', kind: 'driver',
  synonyms: ['driver', 'drivername', 'drivernm', 'chalak', 'operator'],
}

const NOTES: FieldDef = {
  id: 'notes', label: 'Notes', kind: 'text',
  synonyms: ['notes', 'note', 'remarks', 'remark', 'comment', 'comments', 'narration'],
}

const PAYMENT: FieldDef = {
  id: 'paymentMethod', label: 'Payment method', kind: 'text',
  synonyms: ['payment', 'paymentmode', 'paymentmethod', 'mode', 'paidby', 'paymenttype', 'modeofpayment'],
}

const ODOMETER: FieldDef = {
  id: 'odometer', label: 'Odometer', kind: 'number',
  synonyms: ['odometer', 'odo', 'meter', 'meterreading', 'kmreading', 'kilometerreading',
    'reading', 'closingkm', 'currentkm', 'odoreading'],
}

export const SHEET_SCHEMAS: SheetSchema[] = [
  {
    kind: 'trips',
    label: 'Trips',
    nameHints: ['trip', 'workout', 'work out', 'freight', 'lr', 'load', 'consignment', 'revenue', 'income', 'sales', 'booking'],
    fields: [
      DATE, VEHICLE, DRIVER,
      { id: 'reference', label: 'Trip reference', kind: 'text',
        synonyms: ['reference', 'ref', 'refno', 'tripno', 'tripnumber', 'tripid', 'lrno',
          'lrnumber', 'gcno', 'bilty', 'billno', 'invoiceno', 'challanno', 'docno', 'srno'] },
      { id: 'from', label: 'From', kind: 'text', signal: 1,
        synonyms: ['from', 'fromlocation', 'source', 'origin', 'loading', 'loadingpoint',
          'loadingplace', 'pickup', 'startlocation', 'start', 'fromplace', 'frm'] },
      { id: 'to', label: 'To', kind: 'text', signal: 1,
        synonyms: ['to', 'tolocation', 'destination', 'dest', 'unloading', 'unloadingpoint',
          'unloadingplace', 'delivery', 'deliverypoint', 'drop', 'toplace'] },
      { id: 'km', label: 'Kilometres', kind: 'number',
        synonyms: ['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers',
          'distance', 'runningkm', 'tripkm', 'totalkm'] },
      { id: 'tonnage', label: 'Tonnage', kind: 'number', signal: 2,
        synonyms: ['tonnage', 'ton', 'tons', 'tonne', 'tonnes', 'mt', 'weight', 'netweight',
          'qty', 'quantity', 'load', 'loadweight', 'wt'] },
      { id: 'ratePerTon', label: 'Rate per tonne', kind: 'number', signal: 2,
        synonyms: ['rate', 'rateperton', 'pricePerTon', 'priceperton', 'perton', 'ratepermt',
          'freightrate', 'rateperton', 'unitrate'] },
      { id: 'freight', label: 'Freight', kind: 'number', signal: 2,
        synonyms: ['freight', 'freightamount', 'amount', 'total', 'totalamount', 'revenue',
          'income', 'billamount', 'tripamount', 'value', 'grossamount', 'netamount'] },
      { id: 'status', label: 'Status', kind: 'text',
        synonyms: ['status', 'tripstatus', 'state'] },
      NOTES,
    ],
  },
  {
    kind: 'fuel',
    label: 'Diesel',
    nameHints: ['fuel', 'diesel', 'hsd', 'petrol', 'filling', 'pump'],
    fields: [
      DATE, VEHICLE, DRIVER, ODOMETER, PAYMENT, NOTES,
      { id: 'station', label: 'Fuel station', kind: 'text', signal: 1,
        synonyms: ['station', 'fuelstation', 'pump', 'petrolpump', 'bunk', 'fillingstation',
          'vendor', 'supplier', 'dealer', 'outlet'] },
      { id: 'litres', label: 'Litres', kind: 'number', required: true, signal: 3,
        synonyms: ['litres', 'liters', 'litre', 'liter', 'ltr', 'ltrs', 'lt', 'lts',
          'qty', 'quantity', 'volume', 'fuelqty', 'dieselltr', 'dieselqty', 'ltrfilled'] },
      { id: 'pricePerLitre', label: 'Price per litre', kind: 'number', signal: 2,
        synonyms: ['rate', 'price', 'priceperlitre', 'rateperlitre', 'perlitre', 'perltr',
          'unitprice', 'rateltr', 'dieselrate'] },
      { id: 'amount', label: 'Amount', kind: 'number', required: true,
        synonyms: ['amount', 'total', 'totalamount', 'value', 'cost', 'dieselamount', 'fuelamount', 'netamount'] },
    ],
  },
  {
    kind: 'adblue',
    label: 'AdBlue',
    nameHints: ['adblue', 'ad blue', 'urea', 'def'],
    fields: [
      DATE, VEHICLE, DRIVER, ODOMETER, PAYMENT, NOTES,
      { id: 'station', label: 'Supplier', kind: 'text',
        synonyms: ['station', 'pump', 'vendor', 'supplier', 'dealer', 'outlet', 'shop'] },
      { id: 'litres', label: 'Litres', kind: 'number', signal: 2,
        synonyms: ['litres', 'liters', 'litre', 'ltr', 'ltrs', 'qty', 'quantity', 'volume'] },
      { id: 'pricePerLitre', label: 'Price per litre', kind: 'number',
        synonyms: ['rate', 'price', 'priceperlitre', 'rateperlitre', 'perlitre', 'unitprice'] },
      { id: 'amount', label: 'Amount', kind: 'number', required: true,
        synonyms: ['amount', 'total', 'totalamount', 'value', 'cost', 'netamount'] },
    ],
  },
  {
    kind: 'expenses',
    label: 'Expenses',
    nameHints: ['expense', 'expenditure', 'cost', 'payment', 'outgoing', 'debit', 'misc', 'other', 'fastag', 'toll'],
    fields: [
      DATE, VEHICLE, PAYMENT, DRIVER,
      { id: 'category', label: 'Category', kind: 'category', required: true, signal: 3,
        synonyms: ['category', 'type', 'expensetype', 'expensehead', 'head', 'particulars',
          'particular', 'nature', 'expense', 'item', 'headofexpense', 'expensecategory', 'account'] },
      { id: 'amount', label: 'Amount', kind: 'number', required: true,
        synonyms: ['amount', 'total', 'totalamount', 'value', 'cost', 'debit', 'paid', 'expense', 'netamount'] },
      { id: 'description', label: 'Description', kind: 'text',
        synonyms: ['description', 'details', 'detail', 'remarks', 'remark', 'notes',
          'narration', 'comment', 'purpose'] },
      { id: 'reference', label: 'Reference', kind: 'text',
        synonyms: ['reference', 'ref', 'refno', 'billno', 'voucher', 'voucherno', 'receipt', 'receiptno', 'invoiceno'] },
    ],
  },
  {
    kind: 'maintenance',
    label: 'Maintenance',
    nameHints: ['maintenance', 'service', 'repair', 'workshop', 'garage', 'tyre', 'spare'],
    fields: [
      DATE, VEHICLE, ODOMETER,
      { id: 'type', label: 'Work type', kind: 'category', signal: 2,
        synonyms: ['type', 'work', 'worktype', 'job', 'jobtype', 'servicetype', 'nature',
          'category', 'particulars', 'head'] },
      { id: 'cost', label: 'Cost', kind: 'number', required: true,
        synonyms: ['cost', 'amount', 'total', 'totalamount', 'value', 'charges', 'billamount', 'netamount'] },
      { id: 'description', label: 'Work done', kind: 'text', signal: 1,
        synonyms: ['description', 'workdone', 'details', 'particulars', 'remarks', 'narration', 'jobdescription'] },
      { id: 'nextServiceDue', label: 'Next service due', kind: 'date', signal: 2,
        synonyms: ['nextservice', 'nextservicedue', 'duedate', 'nextdue', 'servicedue', 'nextdueon'] },
    ],
  },
  {
    kind: 'vehicles',
    label: 'Vehicles',
    nameHints: ['vehicle', 'truck', 'fleet', 'lorry', 'master'],
    fields: [
      { ...VEHICLE, id: 'registration', label: 'Registration' },
      { id: 'name', label: 'Vehicle name', kind: 'text', signal: 1,
        synonyms: ['name', 'vehiclename', 'truckname', 'alias', 'code', 'vehiclecode', 'shortname'] },
      { id: 'type', label: 'Vehicle type', kind: 'text', signal: 1,
        synonyms: ['type', 'vehicletype', 'class', 'category', 'wheeler', 'bodytype', 'model type'] },
      { id: 'make', label: 'Manufacturer', kind: 'text', signal: 1,
        synonyms: ['make', 'manufacturer', 'brand', 'company'] },
      { id: 'model', label: 'Model', kind: 'text', synonyms: ['model', 'variant'] },
      { id: 'year', label: 'Year', kind: 'number',
        synonyms: ['year', 'modelyear', 'mfgyear', 'manufacturingyear', 'yom', 'yearofmanufacture'] },
      { id: 'tankCapacity', label: 'Tank capacity', kind: 'number', signal: 1,
        synonyms: ['tank', 'tankcapacity', 'capacity', 'fueltank', 'tanksize'] },
      ODOMETER,
      { id: 'status', label: 'Status', kind: 'text', synonyms: ['status', 'active', 'condition'] },
    ],
  },
  {
    kind: 'drivers',
    label: 'Drivers',
    nameHints: ['driver', 'staff', 'employee', 'chalak'],
    fields: [
      { id: 'name', label: 'Driver name', kind: 'text', required: true, signal: 2,
        synonyms: ['name', 'drivername', 'driver', 'employeename', 'staffname', 'chalak'] },
      { id: 'phone', label: 'Phone', kind: 'text', signal: 2,
        synonyms: ['phone', 'phoneno', 'mobile', 'mobileno', 'contact', 'contactno', 'cell', 'number'] },
      { id: 'license', label: 'Licence number', kind: 'text', signal: 3,
        synonyms: ['license', 'licence', 'licenseno', 'licenceno', 'licensenumber',
          'licencenumber', 'dl', 'dlno', 'dlnumber', 'drivinglicense', 'drivinglicence'] },
      { id: 'licenseExpiry', label: 'Licence expiry', kind: 'date', signal: 2,
        synonyms: ['licenseexpiry', 'licenceexpiry', 'dlexpiry', 'validtill', 'validupto',
          'expiry', 'expirydate', 'licensevalidity'] },
      { id: 'joiningDate', label: 'Joining date', kind: 'date', signal: 1,
        synonyms: ['joining', 'joiningdate', 'doj', 'dateofjoining', 'joined'] },
      VEHICLE,
      { id: 'salary', label: 'Monthly salary', kind: 'number', signal: 1,
        synonyms: ['salary', 'monthlysalary', 'wage', 'wages', 'pay', 'basicsalary', 'basesalary'] },
    ],
  },
  {
    kind: 'driver-payments',
    label: 'Driver payments',
    nameHints: ['driverpayment', 'driver payment', 'salary', 'batta', 'bata', 'advance', 'wages', 'payroll'],
    fields: [
      DATE, NOTES,
      { ...DRIVER, required: true, signal: 2 },
      { id: 'type', label: 'Payment type', kind: 'text', signal: 2,
        synonyms: ['type', 'paymenttype', 'nature', 'category', 'head', 'particulars'] },
      { id: 'amount', label: 'Amount', kind: 'number', required: true,
        synonyms: ['amount', 'total', 'value', 'paid', 'salary', 'netamount'] },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Header matching                                                     */
/* ------------------------------------------------------------------ */

export interface HeaderMatch {
  fieldId: string
  confidence: number
}

/** Scores one header against one field: exact, then containment, then nothing. */
function score(headerKey: string, field: FieldDef): number {
  if (!headerKey) return 0
  for (const synonym of field.synonyms) {
    if (headerKey === synonym) return 1
  }
  for (const synonym of field.synonyms) {
    if (synonym.length < 3) continue
    if (headerKey.includes(synonym) || synonym.includes(headerKey)) {
      // Closer lengths mean a closer match: "dieselamount" beats "amount" for
      // a header reading "dieselamountinr".
      const ratio = Math.min(headerKey.length, synonym.length) / Math.max(headerKey.length, synonym.length)
      return 0.55 + ratio * 0.3
    }
  }
  return 0
}

/**
 * Assigns headers to fields for one schema.
 *
 * Every header/field pair is scored, then claimed best-first, so a single
 * strong match wins its column outright rather than two fields fighting over
 * the same one. Unmatched headers are simply left alone — a workbook is
 * allowed to carry columns this product has no use for.
 */
export function mapHeaders(headers: string[], schema: SheetSchema): Map<number, HeaderMatch> {
  const candidates: { column: number; fieldId: string; confidence: number }[] = []
  headers.forEach((header, column) => {
    const headerKey = key(header)
    if (!headerKey) return
    for (const field of schema.fields) {
      const confidence = score(headerKey, field)
      if (confidence > 0) candidates.push({ column, fieldId: field.id, confidence })
    }
  })
  candidates.sort((a, b) => b.confidence - a.confidence)

  const byColumn = new Map<number, HeaderMatch>()
  const claimed = new Set<string>()
  for (const c of candidates) {
    if (byColumn.has(c.column) || claimed.has(c.fieldId)) continue
    byColumn.set(c.column, { fieldId: c.fieldId, confidence: c.confidence })
    claimed.add(c.fieldId)
  }
  return byColumn
}

/**
 * Decides what a sheet is.
 *
 * Two thirds of the verdict comes from which distinctive fields were found —
 * litres means fuel, a head of expenditure means expenses — and a third from
 * the tab's own name, which is a hint rather than an answer because plenty of
 * workbooks call every tab "Sheet1".
 */
export function classifySheet(sheetName: string, headers: string[]): {
  kind: SheetKind
  confidence: number
  schema: SheetSchema | null
  mapping: Map<number, HeaderMatch>
} {
  const name = sheetName.toLowerCase()
  let best: { schema: SheetSchema; confidence: number; mapping: Map<number, HeaderMatch> } | null = null

  for (const schema of SHEET_SCHEMAS) {
    const mapping = mapHeaders(headers, schema)
    const found = new Set([...mapping.values()].map((m) => m.fieldId))

    const signalTotal = schema.fields.reduce((a, f) => a + (f.signal ?? 0), 0)
    const signalFound = schema.fields.reduce((a, f) => a + (found.has(f.id) ? (f.signal ?? 0) : 0), 0)
    const required = schema.fields.filter((f) => f.required)
    const requiredFound = required.filter((f) => found.has(f.id)).length

    // Missing a required field is close to disqualifying.
    const requiredScore = required.length ? requiredFound / required.length : 1
    const signalScore = signalTotal ? signalFound / signalTotal : 0
    const nameScore = schema.nameHints.some((h) => name.includes(h)) ? 1 : 0

    const confidence = requiredScore * 0.35 + signalScore * 0.45 + nameScore * 0.2
    if (!best || confidence > best.confidence) best = { schema, confidence, mapping }
  }

  if (!best || best.confidence < 0.4) {
    return { kind: 'unknown', confidence: best?.confidence ?? 0, schema: null, mapping: new Map() }
  }
  return {
    kind: best.schema.kind,
    confidence: Math.min(1, best.confidence),
    schema: best.schema,
    mapping: best.mapping,
  }
}

/**
 * Finds the row the table actually starts on.
 *
 * Company workbooks routinely open with a title, a logo row and a blank line
 * before the headers. The header row is the one whose cells match the most
 * known column names, so it is found by scoring rather than assumed to be row 1.
 */
export function findHeaderRow(rows: Cell[][]): number {
  const limit = Math.min(rows.length, 12)
  let bestRow = 0
  let bestScore = -1

  for (let r = 0; r < limit; r++) {
    const cells = rows[r] ?? []
    const filled = cells.filter((c) => c != null && String(c).trim() !== '')
    if (filled.length < 2) continue
    // Headers are text, not figures.
    const textish = filled.filter((c) => typeof c === 'string').length
    let matched = 0
    for (const schema of SHEET_SCHEMAS) {
      const mapping = mapHeaders(cells.map((c) => (c == null ? '' : String(c))), schema)
      matched = Math.max(matched, mapping.size)
    }
    const score = matched * 2 + textish - r * 0.5
    if (score > bestScore) { bestScore = score; bestRow = r }
  }
  return bestRow
}
