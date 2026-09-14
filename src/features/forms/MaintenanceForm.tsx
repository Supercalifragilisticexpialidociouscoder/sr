import { useCallback, useEffect, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  SelectField, TextAreaField, TextField, useFormState, num, type Errors,
} from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { money, todayISO, number as fmtNumber } from '../../data/format'
import { MAINTENANCE_TYPE_LABEL, type Maintenance, type MaintenanceType } from '../../data/types'

interface Values {
  date: string
  vehicleId: string
  type: string
  cost: string
  odometer: string
  description: string
  nextServiceDue: string
}

export function MaintenanceForm({
  open, onClose, edit, presetVehicleId,
}: {
  open: boolean
  onClose: () => void
  edit?: Maintenance
  presetVehicleId?: string
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => {
    if (edit) {
      return {
        date: edit.date, vehicleId: edit.vehicleId, type: edit.type,
        cost: String(edit.cost), odometer: String(edit.odometer),
        description: edit.description, nextServiceDue: edit.nextServiceDue ?? '',
      }
    }
    const vehicleId = presetVehicleId ?? db.vehicles[0]?.id ?? ''
    const vehicle = db.vehicles.find((v) => v.id === vehicleId)
    return {
      date: today, vehicleId, type: 'service', cost: '',
      odometer: vehicle ? String(vehicle.odometer) : '', description: '', nextServiceDue: '',
    }
  }, [edit, presetVehicleId, db.vehicles, today])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.date) e.date = 'Date is required'
    else if (v.date > today) e.date = 'Date cannot be in the future'
    if (!v.vehicleId) e.vehicleId = 'Select the vehicle'
    if (v.cost === '') e.cost = 'Cost is required'
    else if (num(v.cost) < 0) e.cost = 'Cost cannot be negative'
    if (v.odometer === '') e.odometer = 'Odometer reading is required'
    else if (num(v.odometer) < 0) e.odometer = 'Odometer cannot be negative'
    if (!v.description.trim()) e.description = 'Describe the work carried out'
    if (v.nextServiceDue && v.nextServiceDue < v.date) e.nextServiceDue = 'Next service cannot fall before this one'
    return e
  }, [today])

  const form = useFormState(initial, validate)
  const { values, set, patch, field } = form

  const vehicleId = values.vehicleId
  useEffect(() => {
    if (edit) return
    const vehicle = db.vehicles.find((v) => v.id === vehicleId)
    if (vehicle) patch({ odometer: String(vehicle.odometer) })
  }, [vehicleId, db.vehicles, patch, edit])

  const submit = () => {
    if (!form.attemptSubmit()) return
    const record: Maintenance = {
      id: edit?.id ?? newId(),
      date: values.date,
      vehicleId: values.vehicleId,
      type: values.type as MaintenanceType,
      cost: num(values.cost),
      odometer: num(values.odometer),
      description: values.description.trim(),
      nextServiceDue: values.nextServiceDue || undefined,
      createdAt: edit?.createdAt ?? new Date().toISOString(),
    }
    dispatch({ type: edit ? 'maintenance/update' : 'maintenance/add', payload: record })
    const vehicle = db.vehicles.find((v) => v.id === record.vehicleId)
    toast.success(
      edit ? 'Maintenance record updated' : `${money(record.cost)} maintenance recorded`,
      `${MAINTENANCE_TYPE_LABEL[record.type]} on ${vehicle?.name ?? 'the vehicle'}`,
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit maintenance record' : 'Add maintenance'}
      description="Service, tyres, punctures, repairs and parts all post to the expense ledger from here."
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Add maintenance'}
      width={620}
    >
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
          label="Type" required
          options={(Object.keys(MAINTENANCE_TYPE_LABEL) as MaintenanceType[]).map((t) => ({ value: t, label: MAINTENANCE_TYPE_LABEL[t] }))}
          value={values.type}
          onChange={(e) => set('type', e.target.value)}
        />
        <TextField label="Cost" required type="number" inputMode="decimal" min={0} prefix="₹" placeholder="14500" {...field('cost')} />
        <TextField
          label="Odometer" required type="number" inputMode="numeric" min={0} suffix="km"
          hint={`Current reading: ${fmtNumber(db.vehicles.find((v) => v.id === values.vehicleId)?.odometer ?? 0)} km`}
          {...field('odometer')}
        />
        <TextField
          label="Next service due" optional type="date" min={values.date}
          hint="Drives the service-due warnings."
          {...field('nextServiceDue')}
        />
        <TextAreaField
          label="Description" required rows={2} className="form-full"
          placeholder="Engine oil, filters, greasing, brake inspection"
          {...field('description')}
        />
      </div>
    </FormModal>
  )
}
