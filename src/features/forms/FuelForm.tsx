import { useCallback, useEffect, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  ChoiceField, ComputedField, SelectField, TextAreaField, TextField, useFormState, num,
  type Errors,
} from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { fuelCost, safeDiv } from '../../data/calc'
import { money, number as fmtNumber, todayISO } from '../../data/format'
import {
  PAYMENT_METHOD_LABEL,
  type FuelEntry, type FuelProduct, type PaymentMethod,
} from '../../data/types'

interface Values {
  product: string
  date: string
  vehicleId: string
  driverId: string
  fuelStation: string
  litres: string
  pricePerLitre: string
  odometer: string
  paymentMethod: string
  notes: string
}

export function FuelForm({
  open, onClose, edit, presetVehicleId,
}: {
  open: boolean
  onClose: () => void
  edit?: FuelEntry
  presetVehicleId?: string
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => {
    if (edit) {
      return {
        product: edit.product, date: edit.date, vehicleId: edit.vehicleId, driverId: edit.driverId ?? '',
        fuelStation: edit.fuelStation, litres: String(edit.litres),
        pricePerLitre: String(edit.pricePerLitre), odometer: String(edit.odometer),
        paymentMethod: edit.paymentMethod, notes: edit.notes ?? '',
      }
    }
    const vehicleId = presetVehicleId ?? db.vehicles[0]?.id ?? ''
    const vehicle = db.vehicles.find((v) => v.id === vehicleId)
    const driver = db.drivers.find((d) => d.assignedVehicleId === vehicleId)
    return {
      product: 'diesel', date: today, vehicleId, driverId: driver?.id ?? '', fuelStation: '',
      litres: '', pricePerLitre: '', odometer: vehicle ? String(vehicle.odometer) : '',
      paymentMethod: 'card', notes: '',
    }
  }, [edit, presetVehicleId, db.vehicles, db.drivers, today])

  /** Highest odometer already recorded on or before this date for this vehicle. */
  const priorOdometer = useCallback((vehicleId: string, date: string, excludeId?: string) => {
    const readings = db.fuel
      .filter((f) => f.vehicleId === vehicleId && f.date <= date && f.id !== excludeId)
      .map((f) => f.odometer)
    return readings.length ? Math.max(...readings) : null
  }, [db.fuel])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.date) e.date = 'Date is required'
    else if (v.date > today) e.date = 'Date cannot be in the future'
    if (!v.vehicleId) e.vehicleId = 'Select the vehicle that was filled'
    if (!v.fuelStation.trim()) e.fuelStation = 'Fuel station is required'
    if (v.litres === '') e.litres = 'Litres is required'
    else if (num(v.litres) <= 0) e.litres = 'Litres must be more than zero'
    if (v.pricePerLitre === '') e.pricePerLitre = 'Price per litre is required'
    else if (num(v.pricePerLitre) <= 0) e.pricePerLitre = 'Price per litre must be more than zero'

    if (v.odometer === '') e.odometer = 'Odometer reading is required'
    else if (num(v.odometer) < 0) e.odometer = 'Odometer cannot be negative'
    else if (v.vehicleId) {
      const prior = priorOdometer(v.vehicleId, v.date, edit?.id)
      if (prior != null && num(v.odometer) < prior) {
        e.odometer = `Last reading on or before this date was ${fmtNumber(prior)} km — an odometer cannot go backwards`
      }
    }
    return e
  }, [today, priorOdometer, edit?.id])

  const form = useFormState(initial, validate)
  const { values, set, patch, field } = form

  const total = fuelCost(num(values.litres), num(values.pricePerLitre))

  /* Switching vehicle brings across its driver and current odometer. */
  const vehicleId = values.vehicleId
  useEffect(() => {
    if (edit) return
    const vehicle = db.vehicles.find((v) => v.id === vehicleId)
    const driver = db.drivers.find((d) => d.assignedVehicleId === vehicleId)
    patch({ driverId: driver?.id ?? '', odometer: vehicle ? String(vehicle.odometer) : '' })
  }, [vehicleId, db.vehicles, db.drivers, patch, edit])

  /* Distance and mileage since the previous fill, shown as the user types. */
  const prior = values.vehicleId ? priorOdometer(values.vehicleId, values.date, edit?.id) : null
  const distance = prior != null && num(values.odometer) > prior ? num(values.odometer) - prior : null
  const mileage = distance != null ? safeDiv(distance, num(values.litres)) : null

  const submit = () => {
    if (!form.attemptSubmit()) return
    const record: FuelEntry = {
      id: edit?.id ?? newId(),
      date: values.date,
      product: values.product as FuelProduct,
      vehicleId: values.vehicleId,
      driverId: values.driverId || null,
      fuelStation: values.fuelStation.trim(),
      litres: num(values.litres),
      pricePerLitre: num(values.pricePerLitre),
      totalAmount: total,
      odometer: num(values.odometer),
      paymentMethod: values.paymentMethod as PaymentMethod,
      notes: values.notes.trim() || undefined,
      createdAt: edit?.createdAt ?? new Date().toISOString(),
    }
    dispatch({ type: edit ? 'fuel/update' : 'fuel/add', payload: record })

    // The tank was filled at this reading, so the vehicle's odometer is at
    // least this — keep the registry honest without a second form.
    const vehicle = db.vehicles.find((v) => v.id === record.vehicleId)
    if (vehicle && record.odometer > vehicle.odometer) {
      dispatch({
        type: 'vehicle/update',
        payload: { ...vehicle, odometer: record.odometer, updatedAt: new Date().toISOString() },
      })
    }

    toast.success(
      edit ? 'Fuel entry updated' : `${money(total)} of ${record.product === 'adblue' ? 'AdBlue' : 'diesel'} recorded`,
      `${fmtNumber(record.litres, 1)} L on ${vehicle?.name ?? 'the vehicle'} — counted once.`,
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit fuel entry' : 'Add fuel'}
      description="Diesel and AdBlue are recorded here and nowhere else, so the same fill is never counted twice."
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Add fuel'}
      width={660}
    >
      <div className="stack stack-8">
        <ChoiceField
          label="Product" name="fuel-product" required
          value={values.product}
          onChange={(v) => set('product', v)}
          options={[{ value: 'diesel', label: 'Diesel' }, { value: 'adblue', label: 'AdBlue' }]}
          hint="AdBlue is tracked separately — it is dosed into its own tank and would distort mileage."
        />

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Fill details</legend>
          <div className="form-grid">
            <TextField label="Date" required type="date" max={today} {...field('date')} />
            <SelectField
              label="Vehicle" required
              options={db.vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.registrationNumber}` }))}
              value={values.vehicleId}
              onChange={(e) => set('vehicleId', e.target.value)}
              error={form.errorFor('vehicleId')}
              disabled={db.vehicles.length === 0}
            />
            <SelectField
              label="Driver" optional
              options={[{ value: '', label: 'No driver recorded' }, ...db.drivers.map((d) => ({ value: d.id, label: d.name }))]}
              value={values.driverId}
              onChange={(e) => set('driverId', e.target.value)}
            />
            <TextField label="Fuel station" required placeholder="IOC Avinashi Road" autoComplete="off" {...field('fuelStation')} />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Quantity and cost</legend>
          <div className="form-grid">
            <TextField
              label="Litres" required type="number" inputMode="decimal" min={0} step="0.01"
              suffix="L" placeholder="220" {...field('litres')}
            />
            <TextField
              label="Price per litre" required type="number" inputMode="decimal" min={0} step="0.01"
              prefix="₹" placeholder="94.60" {...field('pricePerLitre')}
            />
          </div>
          <ComputedField
            label="Total amount"
            value={money(total)}
            formula={
              num(values.litres) > 0 && num(values.pricePerLitre) > 0
                ? `${fmtNumber(num(values.litres), 1)} L × ₹${num(values.pricePerLitre)} per litre`
                : 'Enter litres and rate to calculate'
            }
          />
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Odometer and payment</legend>
          <div className="form-grid">
            <TextField
              label="Odometer" required type="number" inputMode="numeric" min={0} suffix="km"
              hint={
                mileage != null
                  ? `${fmtNumber(distance ?? 0)} km since the last fill — ${fmtNumber(mileage, 2)} km/L`
                  : prior != null
                    ? `Last recorded reading: ${fmtNumber(prior)} km`
                    : 'The first reading for this vehicle sets the baseline for mileage.'
              }
              {...field('odometer')}
            />
            <SelectField
              label="Payment method" required
              options={(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))}
              value={values.paymentMethod}
              onChange={(e) => set('paymentMethod', e.target.value)}
            />
            <TextAreaField label="Notes" optional rows={2} className="form-full" {...field('notes')} />
          </div>
        </fieldset>
      </div>
    </FormModal>
  )
}
