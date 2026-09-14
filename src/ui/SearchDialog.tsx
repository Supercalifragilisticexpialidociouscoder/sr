/**
 * Global search.
 *
 * One box over every record: a registration, a driver, a trip reference, a fuel
 * station, the wording of an expense. Results are grouped by what they are, so
 * a registration returns the vehicle first and then everything logged against
 * it, rather than a flat list the reader has to sort out.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { useDb } from '../data/store'
import { date as formatDate, money, plate as formatPlate } from '../data/format'
import { registrationKey } from '../data/excel/normalize'
import { CATEGORY_LABEL, MAINTENANCE_TYPE_LABEL } from '../data/types'
import { FuelIcon, ReceiptIcon, RouteIcon, TruckIcon, UsersIcon, WrenchIcon } from './icons'

interface Hit {
  id: string
  group: string
  icon: React.ReactNode
  title: string
  meta: string
  amount?: number
  href: string
}

const LIMIT_PER_GROUP = 6

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) setQuery('') }, [open])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const regQ = registrationKey(q)
    const has = (...parts: (string | undefined | null)[]) =>
      parts.some((p) => p && p.toLowerCase().includes(q))

    const out: Hit[] = []
    const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name || v.registrationNumber]))

    for (const v of db.vehicles) {
      if (has(v.name, v.registrationNumber) || (regQ.length > 2 && registrationKey(v.registrationNumber).includes(regQ))) {
        out.push({
          id: `v-${v.id}`, group: 'Vehicles', icon: <TruckIcon size={15} />,
          title: v.name || v.registrationNumber,
          meta: formatPlate(v.registrationNumber),
          href: `/fleet/vehicles/${v.id}`,
        })
      }
    }
    for (const d of db.drivers) {
      if (has(d.name, d.phone, d.licenseNumber)) {
        out.push({
          id: `d-${d.id}`, group: 'Drivers', icon: <UsersIcon size={15} />,
          title: d.name, meta: d.phone || d.licenseNumber || 'Driver',
          href: `/fleet/drivers/${d.id}`,
        })
      }
    }
    for (const t of db.trips) {
      const vehicleMatch = regQ.length > 2 && registrationKey(vehicleName.get(t.vehicleId) ?? '').includes(regQ)
      if (has(t.reference, t.startLocation, t.destination) || vehicleMatch) {
        out.push({
          id: `t-${t.id}`, group: 'Trips', icon: <RouteIcon size={15} />,
          title: `${t.startLocation} → ${t.destination}`,
          meta: `${formatDate(t.date)} · ${vehicleName.get(t.vehicleId) ?? ''}${t.reference ? ` · ${t.reference}` : ''}`,
          amount: t.freightAmount,
          href: `/fleet/vehicles/${t.vehicleId}/trips`,
        })
      }
    }
    for (const f of db.fuel) {
      if (has(f.fuelStation, f.notes)) {
        out.push({
          id: `f-${f.id}`, group: 'Fuel', icon: <FuelIcon size={15} />,
          title: f.fuelStation || (f.product === 'adblue' ? 'AdBlue' : 'Diesel'),
          meta: `${formatDate(f.date)} · ${vehicleName.get(f.vehicleId) ?? ''} · ${f.litres} L`,
          amount: f.totalAmount,
          href: `/fleet/vehicles/${f.vehicleId}/fuel`,
        })
      }
    }
    for (const e of db.expenses) {
      if (has(e.description, e.reference, CATEGORY_LABEL[e.category])) {
        out.push({
          id: `e-${e.id}`, group: 'Expenses', icon: <ReceiptIcon size={15} />,
          title: e.description || CATEGORY_LABEL[e.category],
          meta: `${formatDate(e.date)} · ${CATEGORY_LABEL[e.category]}${e.vehicleId ? ` · ${vehicleName.get(e.vehicleId) ?? ''}` : ''}`,
          amount: e.amount,
          href: e.vehicleId ? `/fleet/vehicles/${e.vehicleId}/expenses` : '/',
        })
      }
    }
    for (const m of db.maintenance) {
      if (has(m.description, MAINTENANCE_TYPE_LABEL[m.type])) {
        out.push({
          id: `m-${m.id}`, group: 'Maintenance', icon: <WrenchIcon size={15} />,
          title: m.description || MAINTENANCE_TYPE_LABEL[m.type],
          meta: `${formatDate(m.date)} · ${vehicleName.get(m.vehicleId) ?? ''}`,
          amount: m.cost,
          href: `/fleet/vehicles/${m.vehicleId}/maintenance`,
        })
      }
    }
    return out
  }, [db, query])

  const grouped = useMemo(() => {
    const order = ['Vehicles', 'Drivers', 'Trips', 'Fuel', 'Expenses', 'Maintenance']
    return order
      .map((group) => ({ group, items: hits.filter((h) => h.group === group) }))
      .filter((g) => g.items.length > 0)
  }, [hits])

  const go = (href: string) => { onClose(); navigate(href) }

  return (
    <Modal open={open} onClose={onClose} title="Search" width={640}>
      <div className="stack stack-6">
        <input
          ref={inputRef}
          className="input"
          type="search"
          placeholder="Registration, driver, trip reference, fuel station, expense…"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search all records"
        />

        {query.trim().length < 2 ? (
          <p className="section-note">Type at least two characters.</p>
        ) : grouped.length === 0 ? (
          <p className="section-note">Nothing matches “{query.trim()}”.</p>
        ) : (
          <div className="stack stack-7">
            {grouped.map(({ group, items }) => (
              <div className="section" key={group}>
                <div className="section-head">
                  <span className="section-head-label">{group}</span>
                  <span className="section-head-count">{items.length}</span>
                  <span className="section-rule" aria-hidden="true" />
                </div>
                <div className="feed">
                  {items.slice(0, LIMIT_PER_GROUP).map((hit) => (
                    <button
                      type="button"
                      className="feed-item"
                      key={hit.id}
                      onClick={() => go(hit.href)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      <span className="feed-mark" aria-hidden="true">{hit.icon}</span>
                      <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                        <span className="feed-title truncate">{hit.title}</span>
                        <span className="feed-meta truncate">{hit.meta}</span>
                      </span>
                      <span className="feed-amount">{hit.amount != null ? money(hit.amount) : ''}</span>
                    </button>
                  ))}
                </div>
                {items.length > LIMIT_PER_GROUP && (
                  <p className="t-micro t-muted">and {items.length - LIMIT_PER_GROUP} more</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
