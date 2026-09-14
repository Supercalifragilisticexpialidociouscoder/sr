import { useCallback, useEffect, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  ComputedField, SelectField, TextAreaField, TextField, useFormState, num,
  type Errors,
} from '../../ui/Field'
import { Button } from '../../ui/Button'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { tripFreight } from '../../data/calc'
import { money, number as fmtNumber, todayISO } from '../../data/format'
import { TRIP_STATUS_LABEL, type Trip, type TripStatus } from '../../data/types'

interface Values {
  date: string
  reference: string
  vehicleId: string
  driverId: string
  startLocation: string
  destination: string
  kilometres: string
  tonnage: string
  pricePerTon: string
  freightAmount: string
  freightOverride: boolean
  status: string
  notes: string
}

/** Next reference in the SRE/YY/NNNN sequence, continuing from what exists. */
function nextReference(existing: Trip[], today: string): string {
  const yy = today.slice(2, 4)
  const prefix = `SRE/${yy}/`
  const highest = existing
    .filter((t) => t.reference.startsWith(prefix))
    .map((t) => Number(t.reference.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

export function TripForm({
  open, onClose, edit, presetVehicleId,
}: {
  open: boolean
  onClose: () => void
  edit?: Trip
  presetVehicleId?: string
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => {
    if (edit) {
      return {
        date: edit.date, reference: edit.reference, vehicleId: edit.vehicleId,
        driverId: edit.driverId ?? '', startLocation: edit.startLocation,
        destination: edit.destination, kilometres: String(edit.kilometres),
        tonnage: String(edit.tonnage), pricePerTon: String(edit.pricePerTon),
        freightAmount: String(edit.freightAmount), freightOverride: edit.freightOverride,
        status: edit.status, notes: edit.notes ?? '',
      }
    }
    const vehicleId = presetVehicleId ?? db.vehicles[0]?.id ?? ''
    const driver = db.drivers.find((d) => d.assignedVehicleId === vehicleId)
    return {
      date: today, reference: nextReference(db.trips, today), vehicleId,
      driverId: driver?.id ?? '', startLocation: '', destination: '',
      kilometres: '', tonnage: '', pricePerTon: '', freightAmount: '',
      freightOverride: false, status: 'completed', notes: '',
    }
  }, [edit, presetVehicleId, db.vehicles, db.drivers, db.trips, today])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.date) e.date = 'Trip date is required'
    else if (v.date > today) e.date = 'Trip date cannot be in the future'
    if (!v.reference.trim()) e.reference = 'Trip reference is required'
    if (!v.vehicleId) e.vehicleId = 'Select the vehicle that ran this trip'
    if (!v.startLocation.trim()) e.startLocation = 'Starting location is required'
    if (!v.destination.trim()) e.destination = 'Destination is required'
    if (v.kilometres === '') e.kilometres = 'Kilometres is required'
    else if (num(v.kilometres) <= 0) e.kilometres = 'Kilometres must be more than zero'
    if (v.tonnage === '') e.tonnage = 'Tonnage is required'
    else if (num(v.tonnage) <= 0) e.tonnage = 'Tonnage must be more than zero'
    if (v.pricePerTon === '') e.pricePerTon = 'Price per tonne is required'
    else if (num(v.pricePerTon) <= 0) e.pricePerTon = 'Price per tonne must be more than zero'
    if (v.freightOverride) {
      if (v.freightAmount === '') e.freightAmount = 'Enter the agreed freight amount'
      else if (num(v.freightAmount) < 0) e.freightAmount = 'Freight cannot be negative'
    }
    return e
  }, [today])

  const form = useFormState(initial, validate)
  const { values, set, patch, field } = form

  /* Freight is derived, not typed — unless the user deliberately overrides it. */
  const calculated = tripFreight(num(values.tonnage), num(values.pricePerTon))
  const freight = values.freightOverride ? num(values.freightAmount) : calculated

  /* Picking a vehicle brings its driver with it. */
  const vehicleId = values.vehicleId
  useEffect(() => {
    if (edit) return
    const driver = db.drivers.find((d) => d.assignedVehicleId === vehicleId)
    if (driver) patch({ driverId: driver.id })
  }, [vehicleId, db.drivers, patch, edit])

  const submit = () => {
    if (!form.attemptSubmit()) return
    const record: Trip = {
      id: edit?.id ?? newId(),
      date: values.date,
      reference: values.reference.trim(),
      vehicleId: values.vehicleId,
      driverId: values.driverId || null,
      startLocation: values.startLocation.trim(),
      destination: values.destination.trim(),
      kilometres: num(values.kilometres),
      tonnage: num(values.tonnage),
      pricePerTon: num(values.pricePerTon),
      freightAmount: freight,
      freightOverride: values.freightOverride,
      status: values.status as TripStatus,
      notes: values.notes.trim() || undefined,
      createdAt: edit?.createdAt ?? new Date().toISOString(),
    }
    dispatch({ type: edit ? 'trip/update' : 'trip/add', payload: record })
    const vehicle = db.vehicles.find((v) => v.id === record.vehicleId)
    toast.success(
      edit ? `Trip ${record.reference} updated` : `Trip ${record.reference} logged`,
      record.status === 'completed'
        ? `${money(record.freightAmount)} added to ${vehicle?.name ?? 'the vehicle'}'s revenue.`
        : `Saved as ${TRIP_STATUS_LABEL[record.status].toLowerCase()} — it will not count towards revenue yet.`,
    )
    onClose()
  }

  const driverOptions = [
    { value: '', label: 'No driver recorded' },
    ...db.drivers.map((d) => ({ value: d.id, label: d.name })),
  ]

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? `Edit trip ${edit.reference}` : 'Log trip'}
      description="Freight is worked out from tonnage and rate. Completed trips count towards revenue straight away."
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Log trip'}
      width={680}
    >
      <div className="stack stack-8">
        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Trip details</legend>
          <div className="form-grid">
            <TextField label="Trip date" required type="date" max={today} {...field('date')} />
            <TextField
              label="Trip reference" required autoComplete="off"
              hint="Generated in sequence — change it if you use your own numbering."
              {...field('reference')}
            />
            <SelectField
              label="Vehicle" required
              options={db.vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.registrationNumber}` }))}
              placeholder={db.vehicles.length === 0 ? 'No vehicles yet' : undefined}
              value={values.vehicleId}
              onChange={(e) => set('vehicleId', e.target.value)}
              onBlur={() => form.blur('vehicleId')}
              error={form.errorFor('vehicleId')}
              disabled={db.vehicles.length === 0}
            />
            <SelectField
              label="Driver" optional
              options={driverOptions}
              value={values.driverId}
              onChange={(e) => set('driverId', e.target.value)}
              hint="Filled in from the vehicle's assigned driver."
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Route and load</legend>
          <div className="form-grid">
            <TextField label="Starting location" required placeholder="Coimbatore" autoComplete="off" {...field('startLocation')} />
            <TextField label="Destination" required placeholder="Chennai" autoComplete="off" {...field('destination')} />
            <TextField
              label="Kilometres" required type="number" inputMode="decimal" min={0}
              suffix="km" placeholder="508" {...field('kilometres')}
            />
            <TextField
              label="Tonnage" required type="number" inputMode="decimal" min={0} step="0.5"
              suffix="t" placeholder="16" {...field('tonnage')}
            />
            <TextField
              label="Price per tonne" required type="number" inputMode="decimal" min={0}
              prefix="₹" placeholder="2000" {...field('pricePerTon')}
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Freight</legend>
          {values.freightOverride ? (
            <div className="stack stack-4">
              <TextField
                label="Agreed freight amount" required type="number" inputMode="decimal" min={0}
                prefix="₹"
                hint={`Calculated figure would be ${money(calculated)}.`}
                {...field('freightAmount')}
              />
              <div>
                <Button
                  size="sm"
                  onClick={() => patch({ freightOverride: false, freightAmount: '' })}
                >
                  Use the calculated freight instead
                </Button>
              </div>
            </div>
          ) : (
            <ComputedField
              label="Freight amount"
              value={money(calculated)}
              formula={
                num(values.tonnage) > 0 && num(values.pricePerTon) > 0
                  ? `${fmtNumber(num(values.tonnage), 1)} t × ${money(num(values.pricePerTon))} per tonne`
                  : 'Enter tonnage and rate to calculate'
              }
              action={
                <Button
                  size="sm"
                  onClick={() => patch({ freightOverride: true, freightAmount: String(calculated || '') })}
                >
                  Override
                </Button>
              }
            />
          )}
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Status</legend>
          <div className="form-grid">
            <SelectField
              label="Trip status" required
              options={(Object.keys(TRIP_STATUS_LABEL) as TripStatus[]).map((s) => ({ value: s, label: TRIP_STATUS_LABEL[s] }))}
              value={values.status}
              onChange={(e) => set('status', e.target.value)}
              hint="Only completed trips count towards revenue, kilometres and tonnage."
            />
            <TextAreaField
              label="Notes" optional rows={2} className="form-full"
              placeholder="Consignor, material carried, any deduction agreed."
              {...field('notes')}
            />
          </div>
        </fieldset>
      </div>
    </FormModal>
  )
}
