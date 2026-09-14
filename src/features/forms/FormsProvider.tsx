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
import { useLocation } from 'react-router-dom'
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

/** `/fleet/vehicles/<id>/...` — the vehicle the user is currently looking at. */
function useRouteVehicleId(): string | undefined {
  const { pathname } = useLocation()
  return useMemo(() => pathname.match(/^\/fleet\/vehicles\/([^/]+)/)?.[1], [pathname])
}

export function FormsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<FormRequest | null>(null)
  const routeVehicleId = useRouteVehicleId()

  /**
   * A quick action opened while a vehicle is on screen belongs to that
   * vehicle, wherever it was clicked from. Without this the global "Log trip"
   * in the sidebar quietly defaults to the first truck in the fleet while the
   * user is looking at a different one — the same shape of mistake the form is
   * meant to prevent.
   */
  const openForm = useCallback((next: FormRequest) => {
    if (next.kind !== 'driver-payment' && next.kind !== 'vehicle'
        && next.vehicleId === undefined && !next.edit && routeVehicleId) {
      setRequest({ ...next, vehicleId: routeVehicleId })
      return
    }
    setRequest(next)
  }, [routeVehicleId])
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
