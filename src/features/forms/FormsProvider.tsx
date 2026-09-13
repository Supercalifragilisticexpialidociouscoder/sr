/**
 * One host for every data-entry dialog.
 *
 * Any screen can call `openForm({ kind: 'trip', vehicleId })` and the form
 * arrives already scoped to that vehicle — which is what stops the product
 * asking twice for something it already knows.
 */

import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react'
import { VehicleForm } from './VehicleForm'
import { DriverForm } from './DriverForm'
import { TripForm } from './TripForm'
import { FuelForm } from './FuelForm'
import { ExpenseForm } from './ExpenseForm'
import { MaintenanceForm } from './MaintenanceForm'
import { DriverPaymentForm } from './DriverPaymentForm'
import type {
  Driver, Expense, FuelEntry, Maintenance, Trip, Vehicle,
} from '../../data/types'

export type FormRequest =
  | { kind: 'vehicle'; edit?: Vehicle }
  | { kind: 'driver'; edit?: Driver; vehicleId?: string }
  | { kind: 'trip'; edit?: Trip; vehicleId?: string }
  | { kind: 'fuel'; edit?: FuelEntry; vehicleId?: string }
  | { kind: 'expense'; edit?: Expense; vehicleId?: string }
  | { kind: 'maintenance'; edit?: Maintenance; vehicleId?: string }
  | { kind: 'driver-payment'; driverId?: string }

interface FormsApi {
  openForm: (request: FormRequest) => void
  closeForm: () => void
}

const FormsContext = createContext<FormsApi | null>(null)

export function FormsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<FormRequest | null>(null)

  const openForm = useCallback((next: FormRequest) => setRequest(next), [])
  const closeForm = useCallback(() => setRequest(null), [])

  const api = useMemo<FormsApi>(() => ({ openForm, closeForm }), [openForm, closeForm])

  return (
    <FormsContext.Provider value={api}>
      {children}

      {/* Each dialog is keyed by its request so re-opening it starts clean
          rather than inheriting the last entry's half-filled state. */}
      {request?.kind === 'vehicle' && (
        <VehicleForm key={request.edit?.id ?? 'new'} open onClose={closeForm} edit={request.edit} />
      )}
      {request?.kind === 'driver' && (
        <DriverForm
          key={request.edit?.id ?? 'new'} open onClose={closeForm}
          edit={request.edit} presetVehicleId={request.vehicleId}
        />
      )}
      {request?.kind === 'trip' && (
        <TripForm
          key={request.edit?.id ?? `new-${request.vehicleId ?? ''}`} open onClose={closeForm}
          edit={request.edit} presetVehicleId={request.vehicleId}
        />
      )}
      {request?.kind === 'fuel' && (
        <FuelForm
          key={request.edit?.id ?? `new-${request.vehicleId ?? ''}`} open onClose={closeForm}
          edit={request.edit} presetVehicleId={request.vehicleId}
        />
      )}
      {request?.kind === 'expense' && (
        <ExpenseForm
          key={request.edit?.id ?? `new-${request.vehicleId ?? ''}`} open onClose={closeForm}
          edit={request.edit} presetVehicleId={request.vehicleId}
          onSwitch={(target) => {
            const vehicleId = request.vehicleId
            if (target === 'driver-payment') setRequest({ kind: 'driver-payment' })
            else setRequest({ kind: target, vehicleId })
          }}
        />
      )}
      {request?.kind === 'maintenance' && (
        <MaintenanceForm
          key={request.edit?.id ?? `new-${request.vehicleId ?? ''}`} open onClose={closeForm}
          edit={request.edit} presetVehicleId={request.vehicleId}
        />
      )}
      {request?.kind === 'driver-payment' && (
        <DriverPaymentForm
          key={request.driverId ?? 'new'} open onClose={closeForm} presetDriverId={request.driverId}
        />
      )}
    </FormsContext.Provider>
  )
}

export function useForms(): FormsApi {
  const ctx = useContext(FormsContext)
  if (!ctx) throw new Error('useForms must be used inside <FormsProvider>')
  return ctx
}
