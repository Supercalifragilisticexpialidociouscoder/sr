import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './data/store'
import { ToastProvider } from './ui/Toast'
import { ConfirmProvider } from './ui/Confirm'
import { FormsProvider } from './features/forms/FormsProvider'
import { AppShell } from './shell/AppShell'
import { ErrorState, PageSkeleton } from './ui/primitives'
import { FleetPage } from './features/fleet/FleetPage'
import { DriversPage } from './features/drivers/DriversPage'
import { DriverDetailPage } from './features/drivers/DriverDetailPage'
import { VehicleDetailPage } from './features/vehicle/VehicleDetailPage'
import { AnalyticsPage } from './features/analytics/AnalyticsPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { NotFoundPage } from './features/NotFoundPage'

/** Holds the shell steady while records load, so nothing flashes into place. */
function Gate({ children }: { children: React.ReactNode }) {
  const { status, error } = useStore()
  if (status === 'loading') return <PageSkeleton />
  if (status === 'error') {
    return (
      <ErrorState
        message={error ?? 'The stored records could not be read.'}
        onRetry={() => window.location.reload()}
      />
    )
  }
  return <>{children}</>
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Router>
            <FormsProvider>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/fleet" replace />} />
                  <Route path="/fleet" element={<Gate><FleetPage /></Gate>} />
                  <Route path="/fleet/drivers" element={<Gate><DriversPage /></Gate>} />
                  <Route path="/fleet/drivers/:driverId" element={<Gate><DriverDetailPage /></Gate>} />
                  <Route path="/fleet/vehicles/:vehicleId" element={<Gate><VehicleDetailPage /></Gate>} />
                  <Route path="/fleet/vehicles/:vehicleId/:tab" element={<Gate><VehicleDetailPage /></Gate>} />
                  <Route path="/analytics" element={<Gate><AnalyticsPage /></Gate>} />
                  <Route path="/reports" element={<Gate><ReportsPage /></Gate>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </FormsProvider>
          </Router>
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  )
}
