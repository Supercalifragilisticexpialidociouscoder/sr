import { useCallback, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  SelectField, TextField, useFormState, num, type Errors,
} from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { money, todayISO } from '../../data/format'
import {
  CATEGORY_LABEL, DIRECT_CATEGORIES, PAYMENT_METHOD_LABEL,
  type Expense, type ExpenseCategory, type PaymentMethod,
} from '../../data/types'
import { FuelIcon, WrenchIcon, WalletIcon } from '../../ui/icons'

interface Values {
  date: string
  vehicleId: string
  category: string
  amount: string
  description: string
  paymentMethod: string
  reference: string
}

/**
 * Add Expense is the most repeated workflow in the product, so it is kept to
 * seven fields with sensible defaults and the amount focused on open.
 *
 * It offers only categories this ledger owns. Diesel, maintenance and driver
 * payments live in their own records; the shortcuts at the top take the user
 * straight there rather than letting the same rupee be entered twice.
 */
export function ExpenseForm({
  open, onClose, edit, presetVehicleId, onSwitch,
}: {
  open: boolean
  onClose: () => void
  edit?: Expense
  presetVehicleId?: string
  onSwitch?: (target: 'fuel' | 'maintenance' | 'driver-payment') => void
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => (edit ? {
    date: edit.date, vehicleId: edit.vehicleId ?? '', category: edit.category,
    amount: String(edit.amount), description: edit.description,
    paymentMethod: edit.paymentMethod, reference: edit.reference ?? '',
  } : {
    date: today,
    vehicleId: presetVehicleId ?? db.vehicles[0]?.id ?? '',
    category: 'fastag', amount: '', description: '',
    paymentMethod: 'cash', reference: '',
  }), [edit, presetVehicleId, db.vehicles, today])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.date) e.date = 'Date is required'
    else if (v.date > today) e.date = 'Date cannot be in the future'
    if (!v.category) e.category = 'Category is required'
    if (v.amount === '') e.amount = 'Amount is required'
    else if (num(v.amount) <= 0) e.amount = 'Amount must be more than zero'
    if (!v.description.trim()) e.description = 'A short description is required'
    return e
  }, [today])

  const form = useFormState(initial, validate)
  const { values, set, field } = form

  const submit = () => {
    if (!form.attemptSubmit()) return
    const record: Expense = {
      id: edit?.id ?? newId(),
      date: values.date,
      vehicleId: values.vehicleId || null,
      category: values.category as ExpenseCategory,
      amount: num(values.amount),
      description: values.description.trim(),
      paymentMethod: values.paymentMethod as PaymentMethod,
      reference: values.reference.trim() || undefined,
      createdAt: edit?.createdAt ?? new Date().toISOString(),
    }
    dispatch({ type: edit ? 'expense/update' : 'expense/add', payload: record })
    const vehicle = db.vehicles.find((v) => v.id === record.vehicleId)
    toast.success(
      edit ? 'Expense updated' : `${money(record.amount)} expense recorded`,
      `${CATEGORY_LABEL[record.category]}${vehicle ? ` · ${vehicle.name}` : ' · not allocated to a vehicle'}`,
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit expense' : 'Add expense'}
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Add expense'}
      width={580}
    >
      <div className="stack stack-6">
        {!edit && onSwitch && (
          <div className="stack stack-4">
            <p className="field-hint">
              Diesel, maintenance and driver payments are each recorded in their own ledger,
              so they are counted exactly once. Use these instead:
            </p>
            <div className="row row-3 row-wrap">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSwitch('fuel')}>
                <FuelIcon size={14} /> Add fuel
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSwitch('maintenance')}>
                <WrenchIcon size={14} /> Add maintenance
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSwitch('driver-payment')}>
                <WalletIcon size={14} /> Pay driver
              </button>
            </div>
            <hr className="rule" />
          </div>
        )}

        <div className="form-grid">
          <TextField
            label="Amount" required type="number" inputMode="decimal" min={0}
            prefix="₹" placeholder="2400" autoFocus {...field('amount')}
          />
          <TextField label="Date" required type="date" max={today} {...field('date')} />
          <SelectField
            label="Category" required
            options={DIRECT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            value={values.category}
            onChange={(e) => set('category', e.target.value)}
            hint={values.category === 'fastag'
              ? 'FASTag recharges cover the tolls paid by tag. Log cash tolls as Toll.'
              : values.category === 'toll'
                ? 'For tolls paid in cash. Tag-paid tolls belong under FASTag.'
                : undefined}
          />
          <SelectField
            label="Vehicle" optional
            options={[{ value: '', label: 'Not vehicle specific' }, ...db.vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.registrationNumber}` }))]}
            value={values.vehicleId}
            onChange={(e) => set('vehicleId', e.target.value)}
          />
          <TextField
            label="Description" required className="form-full" autoComplete="off"
            placeholder="FASTag recharge — Chennai corridor" {...field('description')}
          />
          <SelectField
            label="Payment method" required
            options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
            value={values.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value)}
          />
          <TextField label="Reference / receipt" optional autoComplete="off" placeholder="FT481920" {...field('reference')} />
        </div>
      </div>
    </FormModal>
  )
}
