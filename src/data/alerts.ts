/**
 * Operational warnings.
 *
 * Deliberately narrow. An alert earns its place only if the owner would act on
 * it this week — expiring paperwork, a service coming due, money owed to a
 * driver, or a truck whose costs have jumped. Everything else is a number on a
 * page, not an alert.
 */

import { useMemo } from 'react'
import { addDays, daysBetween } from './format'
import { buildLedger, driverLedger, inRange, sum, type DateRange } from './calc'
import { useDb } from './store'
import { nextServiceFor } from './selectors'
import type { Database } from './types'

export type Severity = 'critical' | 'warning' | 'info'

export interface Alert {
  id: string
  severity: Severity
  title: string
  detail: string
  /** Where the user goes to deal with it. */
  href: string
  actionLabel: string
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

const LICENCE_WARNING_DAYS = 45
const DOCUMENT_WARNING_DAYS = 30
const SERVICE_WARNING_DAYS = 14

export function buildAlerts(db: Database, today: string): Alert[] {
  const alerts: Alert[] = []

  /* Driver licences ------------------------------------------------ */
  for (const d of db.drivers) {
    if (!d.licenseExpiry) continue
    const days = daysBetween(today, d.licenseExpiry)
    if (days < 0) {
      alerts.push({
        id: `lic-${d.id}`, severity: 'critical',
        title: `${d.name}'s licence has expired`,
        detail: `Expired ${Math.abs(days)} days ago. The driver must not be put on a trip until it is renewed.`,
        href: `/fleet/drivers/${d.id}`, actionLabel: 'Open driver',
      })
    } else if (days <= LICENCE_WARNING_DAYS) {
      alerts.push({
        id: `lic-${d.id}`, severity: 'warning',
        title: `${d.name}'s licence expires in ${days} days`,
        detail: `Valid until ${d.licenseExpiry}. Start the renewal at the RTO.`,
        href: `/fleet/drivers/${d.id}`, actionLabel: 'Open driver',
      })
    }
  }

  /* Vehicle paperwork ---------------------------------------------- */
  const documents = [
    { key: 'insuranceExpiry', label: 'Insurance' },
    { key: 'permitExpiry', label: 'Permit' },
    { key: 'fitnessExpiry', label: 'Fitness certificate' },
  ] as const

  for (const v of db.vehicles) {
    if (v.status === 'retired') continue
    for (const doc of documents) {
      const expiry = v[doc.key]
      if (!expiry) continue
      const days = daysBetween(today, expiry)
      if (days < 0) {
        alerts.push({
          id: `doc-${v.id}-${doc.key}`, severity: 'critical',
          title: `${v.name} — ${doc.label.toLowerCase()} has expired`,
          detail: `${doc.label} lapsed ${Math.abs(days)} days ago on ${v.registrationNumber}. Running the vehicle now is an offence.`,
          href: `/fleet/vehicles/${v.id}`, actionLabel: 'Open vehicle',
        })
      } else if (days <= DOCUMENT_WARNING_DAYS) {
        alerts.push({
          id: `doc-${v.id}-${doc.key}`, severity: 'warning',
          title: `${v.name} — ${doc.label.toLowerCase()} expires in ${days} days`,
          detail: `${v.registrationNumber}. Renew before ${expiry}.`,
          href: `/fleet/vehicles/${v.id}`, actionLabel: 'Open vehicle',
        })
      }
    }

    /* Service schedule --------------------------------------------- */
    const service = nextServiceFor(db, v.id)
    if (service?.nextServiceDue) {
      const days = daysBetween(today, service.nextServiceDue)
      if (days < 0) {
        alerts.push({
          id: `svc-${v.id}`, severity: 'critical',
          title: `${v.name} — service overdue by ${Math.abs(days)} days`,
          detail: `Due ${service.nextServiceDue}, last attended at ${service.odometer.toLocaleString('en-IN')} km.`,
          href: `/fleet/vehicles/${v.id}/maintenance`, actionLabel: 'Open maintenance',
        })
      } else if (days <= SERVICE_WARNING_DAYS) {
        alerts.push({
          id: `svc-${v.id}`, severity: 'warning',
          title: `${v.name} — service due in ${days} days`,
          detail: `Scheduled for ${service.nextServiceDue}. Book the workshop slot.`,
          href: `/fleet/vehicles/${v.id}/maintenance`, actionLabel: 'Open maintenance',
        })
      }
    }
  }

  /* Cost spikes ----------------------------------------------------- */
  // A vehicle's last 30 days against the 90 days before it. Flagged only when
  // the jump is both proportionally large and materially big in rupees, so
  // ordinary month-to-month variation stays quiet.
  const ledger = buildLedger(db)
  const recent: DateRange = { from: addDays(today, -29), to: today, label: 'recent' }
  const baseline: DateRange = { from: addDays(today, -119), to: addDays(today, -30), label: 'baseline' }

  for (const v of db.vehicles) {
    const lines = ledger.filter((l) => l.vehicleId === v.id)
    const recentTotal = sum(lines.filter((l) => inRange(l.date, recent)).map((l) => l.amount))
    const baselineTotal = sum(lines.filter((l) => inRange(l.date, baseline)).map((l) => l.amount))
    if (baselineTotal <= 0) continue
    const monthlyBaseline = baselineTotal / 3
    if (recentTotal > monthlyBaseline * 1.5 && recentTotal - monthlyBaseline > 40_000) {
      const overBy = Math.round(recentTotal - monthlyBaseline)
      alerts.push({
        id: `spike-${v.id}`, severity: 'warning',
        title: `${v.name} — costs up sharply this month`,
        detail: `₹${overBy.toLocaleString('en-IN')} above its recent monthly average. Check the expense breakdown before the next trip is priced.`,
        href: `/fleet/vehicles/${v.id}/financials`, actionLabel: 'Open financials',
      })
    }
  }

  /* Money owed to drivers -------------------------------------------
     Flagged only once a driver is owed roughly a month's salary or more, so
     ordinary mid-month timing does not raise an alert every day. */
  for (const d of db.drivers) {
    const account = driverLedger(
      db.driverPayments.filter((p) => p.driverId === d.id),
      d.salary, d.joiningDate, today,
    )
    if (account.pending >= d.salary * 0.9) {
      alerts.push({
        id: `due-${d.id}`, severity: 'warning',
        title: `₹${account.pending.toLocaleString('en-IN')} pending to ${d.name}`,
        detail: `Salary earned since ${account.accrualFrom} exceeds what has been paid, including advances.`,
        href: `/fleet/drivers/${d.id}`, actionLabel: 'Record payment',
      })
    }
  }

  /* Idle capacity ---------------------------------------------------- */
  for (const v of db.vehicles) {
    if (v.status !== 'active' && v.status !== 'idle') continue
    const last = db.trips
      .filter((t) => t.vehicleId === v.id && t.status !== 'cancelled')
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
    const idleDays = last ? Math.abs(daysBetween(today, last.date)) : null
    if (idleDays !== null && idleDays >= 10) {
      alerts.push({
        id: `idle-${v.id}`, severity: 'info',
        title: `${v.name} has not run a trip in ${idleDays} days`,
        detail: `${v.registrationNumber} is marked ${v.status} but is earning nothing. Fixed costs continue regardless.`,
        href: `/fleet/vehicles/${v.id}`, actionLabel: 'Open vehicle',
      })
    }
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

export function useAlerts(today: string): Alert[] {
  const db = useDb()
  return useMemo(() => buildAlerts(db, today), [db, today])
}
