import { useCallback, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  SelectField, TextAreaField, TextField, useFormState, num,
  type Errors,
} from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { todayISO } from '../../data/format'
import {
  FUEL_TYPE_LABEL, VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL,
  type FuelType, type Vehicle, type VehicleStatus, type VehicleType,
} from '../../data/types'

interface Values {
  registrationNumber: string
  name: string
  type: string
  manufacturer: string
  model: string
  manufacturingYear: string
  fuelType: string
  tankCapacity: string
  odometer: string
  status: string
  insuranceExpiry: string
  permitExpiry: string
  fitnessExpiry: string
  notes: string
}

const blank: Values = {
  registrationNumber: '', name: '', type: 'tipper', manufacturer: '', model: '',
  manufacturingYear: String(new Date().getFullYear()), fuelType: 'diesel',
  tankCapacity: '', odometer: '', status: 'active',
  insuranceExpiry: '', permitExpiry: '', fitnessExpiry: '', notes: '',
}

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))

export function VehicleForm({
  open, onClose, edit,
}: {
  open: boolean
  onClose: () => void
  edit?: Vehicle
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()

  const initial = useMemo<Values>(() => (edit ? {
    registrationNumber: edit.registrationNumber,
    name: edit.name,
    type: edit.type,
    manufacturer: edit.manufacturer ?? '',
    model: edit.model ?? '',
    manufacturingYear: edit.manufacturingYear ? String(edit.manufacturingYear) : '',
    fuelType: edit.fuelType,
    tankCapacity: String(edit.tankCapacity),
    odometer: String(edit.odometer),
    status: edit.status,
    insuranceExpiry: edit.insuranceExpiry ?? '',
    permitExpiry: edit.permitExpiry ?? '',
    fitnessExpiry: edit.fitnessExpiry ?? '',
    notes: edit.notes ?? '',
  } : blank), [edit])

  const thisYear = new Date().getFullYear()

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    const reg = v.registrationNumber.trim().toUpperCase()
    if (!reg) e.registrationNumber = 'Registration number is required'
    else if (reg.replace(/\s/g, '').length < 6) e.registrationNumber = 'Enter the full registration, for example TN 38 AQ 4521'
    else if (db.vehicles.some((x) => x.id !== edit?.id && x.registrationNumber.replace(/\s/g, '').toUpperCase() === reg.replace(/\s/g, '')))
      e.registrationNumber = 'A vehicle with this registration already exists'

    if (!v.name.trim()) e.name = 'Vehicle name or internal number is required'
    else if (db.vehicles.some((x) => x.id !== edit?.id && x.name.trim().toLowerCase() === v.name.trim().toLowerCase()))
      e.name = 'Another vehicle already uses this name'

    const year = num(v.manufacturingYear)
    if (v.manufacturingYear && (year < 1980 || year > thisYear + 1)) {
      e.manufacturingYear = `Enter a year between 1980 and ${thisYear + 1}`
    }

    if (v.tankCapacity !== '' && num(v.tankCapacity) <= 0) e.tankCapacity = 'Tank capacity must be more than zero'
    if (v.odometer !== '' && num(v.odometer) < 0) e.odometer = 'Odometer cannot be negative'

    return e
  }, [db.vehicles, edit?.id, thisYear])

  const form = useFormState(initial, validate)
  const { values, field, set } = form

  const submit = () => {
    if (!form.attemptSubmit()) return
    const now = new Date().toISOString()
    const record: Vehicle = {
      id: edit?.id ?? newId(),
      registrationNumber: values.registrationNumber.trim().toUpperCase(),
      name: values.name.trim(),
      type: values.type as VehicleType,
      manufacturer: values.manufacturer.trim() || undefined,
      model: values.model.trim() || undefined,
      manufacturingYear: values.manufacturingYear ? num(values.manufacturingYear) : undefined,
      fuelType: values.fuelType as FuelType,
      tankCapacity: num(values.tankCapacity),
      odometer: num(values.odometer),
      status: values.status as VehicleStatus,
      insuranceExpiry: values.insuranceExpiry || undefined,
      permitExpiry: values.permitExpiry || undefined,
      fitnessExpiry: values.fitnessExpiry || undefined,
      notes: values.notes.trim() || undefined,
      createdAt: edit?.createdAt ?? now,
      updatedAt: now,
    }
    dispatch({ type: edit ? 'vehicle/update' : 'vehicle/add', payload: record })
    toast.success(
      edit ? `${record.name} updated` : `${record.name} added to the fleet`,
      edit ? undefined : `${record.registrationNumber} is ready for trips and expenses.`,
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? `Edit ${edit.name}` : 'Add vehicle'}
      description={edit ? 'Changes apply to every record already logged against this vehicle.' : 'Register a vehicle so trips, fuel and expenses can be logged against it.'}
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Add vehicle'}
      width={660}
    >
      <div className="stack stack-8">
        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Vehicle identity</legend>
          <div className="form-grid">
            <TextField
              label="Registration number" required
              placeholder="TN 38 AQ 4521"
              autoComplete="off" autoCapitalize="characters" spellCheck={false}
              {...field('registrationNumber')}
            />
            <TextField
              label="Vehicle name / internal number" required
              placeholder="SRE-04" autoComplete="off"
              hint="What your team calls this vehicle day to day."
              {...field('name')}
            />
            <SelectField
              label="Vehicle type" required
              options={options(VEHICLE_TYPE_LABEL)}
              value={values.type}
              onChange={(e) => set('type', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Specifications</legend>
          <div className="form-grid">
            <TextField label="Manufacturer" optional placeholder="Tata Motors" {...field('manufacturer')} />
            <TextField label="Model" optional placeholder="Signa 2823.K" {...field('model')} />
            <TextField
              label="Manufacturing year" optional type="number"
              inputMode="numeric" min={1980} max={thisYear + 1} placeholder="2021"
              {...field('manufacturingYear')}
            />
            <SelectField
              label="Fuel type" required
              options={options(FUEL_TYPE_LABEL)}
              value={values.fuelType}
              onChange={(e) => set('fuelType', e.target.value)}
            />
            <TextField
              label="Tank capacity" optional type="number" inputMode="decimal"
              min={0} suffix="L" placeholder="300"
              {...field('tankCapacity')}
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Operational information</legend>
          <div className="form-grid">
            <TextField
              label="Current odometer" optional type="number" inputMode="numeric"
              min={0} suffix="km" placeholder="40928"
              hint="Leave blank if you have not taken a reading yet — fuel entries will set it."
              {...field('odometer')}
            />
            <SelectField
              label="Status" required
              options={options(VEHICLE_STATUS_LABEL)}
              value={values.status}
              onChange={(e) => set('status', e.target.value)}
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Documents</legend>
          <p className="field-hint" style={{ marginTop: -4 }}>
            Expiry dates drive the renewal warnings on the fleet page. Leave blank if you track them elsewhere.
          </p>
          <div className="form-grid">
            <TextField label="Insurance expiry" optional type="date" {...field('insuranceExpiry')} />
            <TextField label="Permit expiry" optional type="date" {...field('permitExpiry')} />
            <TextField label="Fitness certificate expiry" optional type="date" {...field('fitnessExpiry')} />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Additional information</legend>
          <TextAreaField
            label="Notes" optional
            placeholder="Contract worked, body type, any standing instruction for this vehicle."
            rows={3}
            {...field('notes')}
          />
        </fieldset>
      </div>
    </FormModal>
  )
}

export const TODAY = todayISO
