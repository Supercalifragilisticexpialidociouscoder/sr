import { useCallback, useMemo } from 'react'
import { FormModal } from '../../ui/Modal'
import {
  SelectField, TextAreaField, TextField, useFormState, num, type Errors,
} from '../../ui/Field'
import { useStore, newId } from '../../data/store'
import { useToast } from '../../ui/Toast'
import { todayISO } from '../../data/format'
import type { Driver } from '../../data/types'

interface Values {
  name: string
  phone: string
  licenseNumber: string
  licenseExpiry: string
  joiningDate: string
  assignedVehicleId: string
  salary: string
  notes: string
}

export function DriverForm({
  open, onClose, edit, presetVehicleId,
}: {
  open: boolean
  onClose: () => void
  edit?: Driver
  presetVehicleId?: string
}) {
  const { db, dispatch } = useStore()
  const toast = useToast()
  const today = todayISO()

  const initial = useMemo<Values>(() => (edit ? {
    name: edit.name, phone: edit.phone, licenseNumber: edit.licenseNumber,
    licenseExpiry: edit.licenseExpiry ?? '', joiningDate: edit.joiningDate,
    assignedVehicleId: edit.assignedVehicleId ?? '', salary: String(edit.salary),
    notes: edit.notes ?? '',
  } : {
    name: '', phone: '', licenseNumber: '', licenseExpiry: '', joiningDate: today,
    assignedVehicleId: presetVehicleId ?? '', salary: '', notes: '',
  }), [edit, presetVehicleId, today])

  const validate = useCallback((v: Values): Errors<Values> => {
    const e: Errors<Values> = {}
    if (!v.name.trim()) e.name = 'Driver name is required'
    if (!v.phone.trim()) e.phone = 'Phone number is required'
    else if (v.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit mobile number'
    if (!v.licenseNumber.trim()) e.licenseNumber = 'Licence number is required'
    if (!v.joiningDate) e.joiningDate = 'Joining date is required'
    else if (v.joiningDate > today) e.joiningDate = 'Joining date cannot be in the future'
    if (v.salary === '') e.salary = 'Monthly salary is required'
    else if (num(v.salary) < 0) e.salary = 'Salary cannot be negative'
    return e
  }, [today])

  const form = useFormState(initial, validate)
  const { values, set, field } = form

  /* A vehicle carries one driver, so reassigning moves them rather than
     silently leaving two drivers pointing at the same truck. */
  const occupant = db.drivers.find(
    (d) => d.id !== edit?.id && d.assignedVehicleId === values.assignedVehicleId && values.assignedVehicleId,
  )

  const submit = () => {
    if (!form.attemptSubmit()) return
    const now = new Date().toISOString()
    const record: Driver = {
      id: edit?.id ?? newId(),
      name: values.name.trim(),
      phone: values.phone.trim(),
      licenseNumber: values.licenseNumber.trim().toUpperCase(),
      licenseExpiry: values.licenseExpiry || undefined,
      joiningDate: values.joiningDate,
      assignedVehicleId: values.assignedVehicleId || null,
      salary: num(values.salary),
      notes: values.notes.trim() || undefined,
      createdAt: edit?.createdAt ?? now,
      updatedAt: now,
    }
    if (occupant) {
      dispatch({ type: 'driver/update', payload: { ...occupant, assignedVehicleId: null, updatedAt: now } })
    }
    dispatch({ type: edit ? 'driver/update' : 'driver/add', payload: record })
    toast.success(
      edit ? `${record.name} updated` : `${record.name} added`,
      occupant ? `${occupant.name} was unassigned from that vehicle.` : undefined,
    )
    onClose()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={edit ? `Edit ${edit.name}` : 'Add driver'}
      onSubmit={submit}
      submitLabel={edit ? 'Save changes' : 'Add driver'}
      width={640}
    >
      <div className="stack stack-8">
        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Personal details</legend>
          <div className="form-grid">
            <TextField label="Driver name" required placeholder="Murugan S" autoComplete="off" {...field('name')} />
            <TextField label="Phone number" required type="tel" inputMode="tel" placeholder="+91 98430 11245" {...field('phone')} />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Licence</legend>
          <div className="form-grid">
            <TextField
              label="Licence number" required placeholder="TN38 20150004521"
              autoComplete="off" spellCheck={false} {...field('licenseNumber')}
            />
            <TextField
              label="Licence expiry" optional type="date"
              hint="Add it and the fleet page warns you 45 days ahead. Leave blank if you do not track it."
              {...field('licenseExpiry')}
            />
          </div>
        </fieldset>

        <fieldset className="form-section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="form-section-label" style={{ width: '100%' }}>Employment</legend>
          <div className="form-grid">
            <TextField label="Joining date" required type="date" max={today} {...field('joiningDate')} />
            <TextField
              label="Monthly salary" required type="number" inputMode="decimal" min={0}
              prefix="₹" placeholder="24000"
              hint="Used to work out what is still owed."
              {...field('salary')}
            />
            <SelectField
              label="Assigned vehicle" optional
              options={[
                { value: '', label: 'Not assigned' },
                ...db.vehicles.map((v) => ({ value: v.id, label: `${v.name} · ${v.registrationNumber}` })),
              ]}
              value={values.assignedVehicleId}
              onChange={(e) => set('assignedVehicleId', e.target.value)}
              hint={occupant ? `${occupant.name} is currently on this vehicle and will be unassigned.` : undefined}
            />
            <TextAreaField
              label="Notes" optional rows={2} className="form-full"
              placeholder="Routes they know, endorsements held, anything worth remembering."
              {...field('notes')}
            />
          </div>
        </fieldset>
      </div>
    </FormModal>
  )
}
