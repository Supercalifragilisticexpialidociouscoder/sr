/**
 * Application shell.
 *
 * Three navigation treatments, each designed for its width rather than being
 * the desktop one squeezed down:
 *
 *   >= 1024px  a persistent sidebar, with the five quick actions always visible
 *              — no menu to discover
 *   768-1023   a top bar carrying the sections inline and a New button
 *   < 768px    a top bar for identity, and a fixed bottom tab bar for the three
 *              sections plus New, which opens the actions as a sheet
 */

import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Modal } from '../ui/Modal'
import { useConfirm } from '../ui/Confirm'
import { useToast } from '../ui/Toast'
import { useStore } from '../data/store'
import { useForms } from '../features/forms/FormsProvider'
import { useAlerts } from '../data/alerts'
import { todayISO } from '../data/format'
import {
  ChartIcon, FileIcon, FuelIcon, PlusIcon, ReceiptIcon, RouteIcon,
  TrashIcon, TruckIcon, UsersIcon, WrenchIcon,
} from '../ui/icons'

const SECTIONS = [
  { to: '/fleet', label: 'Fleet', Icon: TruckIcon },
  { to: '/analytics', label: 'Analytics', Icon: ChartIcon },
  { to: '/reports', label: 'Reports', Icon: FileIcon },
] as const

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">SR</span>
      <span className="stack" style={{ minWidth: 0, gap: 1 }}>
        <span className="brand-name truncate">SRI RAM ENTERPRISES</span>
        {!compact && <span className="brand-sub truncate">Fleet &amp; Financial Operations</span>}
      </span>
    </div>
  )
}

interface QuickAction {
  label: string
  Icon: typeof TruckIcon
  run: () => void
  primary?: boolean
}

function useQuickActions(): QuickAction[] {
  const { openForm } = useForms()
  return [
    { label: 'Log trip', Icon: RouteIcon, run: () => openForm({ kind: 'trip' }), primary: true },
    { label: 'Add fuel', Icon: FuelIcon, run: () => openForm({ kind: 'fuel' }) },
    { label: 'Add expense', Icon: ReceiptIcon, run: () => openForm({ kind: 'expense' }) },
    { label: 'Add maintenance', Icon: WrenchIcon, run: () => openForm({ kind: 'maintenance' }) },
    { label: 'Add vehicle', Icon: TruckIcon, run: () => openForm({ kind: 'vehicle' }) },
    { label: 'Add driver', Icon: UsersIcon, run: () => openForm({ kind: 'driver' }) },
  ]
}

export function AppShell() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const actions = useQuickActions()
  const location = useLocation()
  const { db, resetDemoData, clearAll } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const alerts = useAlerts(todayISO())

  const urgent = alerts.filter((a) => a.severity !== 'info').length
  const hasCritical = alerts.some((a) => a.severity === 'critical')

  /* A navigation always closes the sheet — it must never linger over a new page. */
  useEffect(() => { setSheetOpen(false) }, [location.pathname])

  /* Every route change returns the reader to the top of the document. */
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }) }, [location.pathname])

  const runAction = useCallback((action: QuickAction) => {
    setSheetOpen(false)
    action.run()
  }, [])

  /* The app opens on demo records so it can be judged with data in it. Both
     directions have to be available: clear them out to start real use, or put
     them back after experimenting. */
  const isEmpty = db.vehicles.length === 0 && db.drivers.length === 0

  const restoreDemo = useCallback(async () => {
    const ok = await confirm({
      title: 'Restore the demo fleet?',
      body: 'This replaces everything currently recorded with the three demo vehicles and their history. Anything you have entered yourself will be lost.',
      confirmLabel: 'Restore demo data',
      destructive: true,
    })
    if (!ok) return
    resetDemoData()
    toast.success('Demo fleet restored')
  }, [confirm, resetDemoData, toast])

  const clearEverything = useCallback(async () => {
    const ok = await confirm({
      title: 'Clear all records?',
      body: `This permanently deletes ${db.vehicles.length} vehicles, ${db.drivers.length} drivers, ${db.trips.length} trips and every fuel, expense and maintenance record with them. It cannot be undone.`,
      confirmLabel: 'Clear everything',
      destructive: true,
    })
    if (!ok) return
    clearAll()
    toast.success('All records cleared', 'Add a vehicle to start entering your own.')
  }, [confirm, clearAll, toast, db])

  const sectionCount = (to: string) => {
    if (to === '/fleet') return db.vehicles.length || undefined
    return undefined
  }

  return (
    <div className="shell">
      <a href="#main-content" className="btn btn-primary sr-only">Skip to content</a>

      <aside className="sidebar">
        <Brand />

        <nav className="nav" aria-label="Sections">
          {SECTIONS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item${isActive ? ' nav-item-on' : ''}`}
            >
              <Icon size={17} />
              <span className="truncate">{label}</span>
              {to === '/fleet' && urgent > 0 ? (
                <span
                  className="nav-count"
                  style={{ color: hasCritical ? 'var(--negative)' : 'var(--warning)' }}
                  title={`${urgent} operational ${urgent === 1 ? 'warning' : 'warnings'}`}
                >
                  {urgent}
                </span>
              ) : (
                sectionCount(to) != null && <span className="nav-count">{sectionCount(to)}</span>
              )}
            </NavLink>
          ))}

          <p className="nav-group-label">Quick actions</p>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.primary ? 'btn btn-primary' : 'nav-item'}
              style={action.primary ? { width: '100%', justifyContent: 'flex-start', marginBottom: 4 } : undefined}
              onClick={() => runAction(action)}
            >
              {action.primary ? <PlusIcon size={15} /> : <action.Icon size={17} />}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot stack stack-3">
          <p className="t-micro t-muted" style={{ lineHeight: 1.5 }}>
            Records are stored on this device.
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifyContent: 'flex-start', paddingInline: 0 }}
            onClick={isEmpty ? restoreDemo : clearEverything}
          >
            {isEmpty ? 'Restore demo data' : 'Clear all records'}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Brand compact />

          <nav className="segment topbar-sections" aria-label="Sections">
            {SECTIONS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `segment-item${isActive ? ' segment-on' : ''}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <PlusIcon size={15} />
            New
          </button>
        </header>

        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav" aria-label="Sections">
        {SECTIONS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottomnav-item${isActive ? ' bottomnav-on' : ''}`}
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          className="bottomnav-item"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        >
          <PlusIcon size={20} />
          New
        </button>
      </nav>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Add a record"
        description="Everything you log here flows straight into the vehicle, the analytics and the reports."
        width={460}
      >
        <div className="quick-sheet stack stack-3">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="quick-item"
              onClick={() => runAction(action)}
            >
              <action.Icon size={18} />
              {action.label}
            </button>
          ))}
          <hr className="rule" style={{ margin: '8px 0' }} />
          <button
            type="button"
            className="quick-item"
            onClick={() => { setSheetOpen(false); if (isEmpty) restoreDemo(); else clearEverything() }}
          >
            <TrashIcon size={18} />
            {isEmpty ? 'Restore demo data' : 'Clear all records'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
