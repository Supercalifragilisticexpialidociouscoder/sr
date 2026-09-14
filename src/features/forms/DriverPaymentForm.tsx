import { useCallback, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import { ChoiceField, SelectField, TextAreaField, TextField, useFormState, num, type Errors } from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { money, todayISO } from '../../data/format'
import { DRIVER_PAYMENT_LABEL, type DriverPayment, type DriverPaymentType } from '../../data/types'

interface Values {
  driverId: string
  date: string
  type: string
  amount: string
  notes: string
}

export function DriverPaymentForm({
  open, onClose, presetDriverId,
}: {
  open: boolean
  onClose: () => void
  presetDriverId?: string
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => ({
    driverId: presetDriverId ?? db.drivers[0]?.id ?? '',
    date: today, type: 'salary', amount: '', notes: '',
  }), [presetDriverId, db.drivers, today])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.driverId) e.driverId = 'Select a driver'
    if (!v.date) e.date = 'Date is required'
    else if (v.date > today) e.date = 'Date cannot be in the future'
    if (v.amount === '') e.amount = 'Amount is required'
    else if (num(v.amount) <= 0) e.amount = 'Amount must be more than zero'
    return e
  }, [today])

  const form = useFormState(initial, validate)
  const { values, set, field } = form

  const submit = () => {
    if (!form.attemptSubmit()) return
    const record: DriverPayment = {
      id: newId(),
      driverId: values.driverId,
      date: values.date,
      type: values.type as DriverPaymentType,
      amount: num(values.amount),
      notes: values.notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    dispatch({ type: 'driverPayment/add', payload: record })
    const driver = db.drivers.find((d) => d.id === record.driverId)
    toast.success(
      `${money(record.amount)} paid to ${driver?.name ?? 'driver'}`,
      'Recorded against the vehicle they are assigned to.',
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Record driver payment"
      description="Counts as a driver cost on the vehicle this driver is assigned to."
      onSubmit={submit}
      submitLabel="Record payment"
      width={540}
    >
      <div className="stack stack-6">
        <ChoiceField
          label="Payment type" name="driver-payment-type" required
          value={values.type}
          onChange={(v) => set('type', v)}
          options={(Object.keys(DRIVER_PAYMENT_LABEL) as DriverPaymentType[])
            .map((t) => ({ value: t, label: DRIVER_PAYMENT_LABEL[t] }))}
        />
        <div className="form-grid">
          <TextField
            label="Amount" required type="number" inputMode="decimal" min={0}
            prefix="₹" placeholder="24000" autoFocus {...field('amount')}
          />
          <TextField label="Date" required type="date" max={today} {...field('date')} />
          <SelectField
            label="Driver" required className="form-full"
            options={db.drivers.map((d) => ({ value: d.id, label: d.name }))}
            value={values.driverId}
            onChange={(e) => set('driverId', e.target.value)}
            error={form.errorFor('driverId')}
            disabled={db.drivers.length === 0}
          />
          <TextAreaField
            label="Notes" optional rows={2} className="form-full"
            placeholder="Salary for August, advance against Deepavali bonus, batta for the Chennai run."
            {...field('notes')}
          />
        </div>
      </div>
    </FormModal>
  )
}
