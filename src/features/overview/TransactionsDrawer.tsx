/**
 * The bottom of the drill-down.
 *
 * A figure on the overview is a sum; this is the list it was summed from. It
 * exists so a number is never something the product merely asserts — every
 * total can be opened until individual transactions are on screen.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../ui/Modal'
import { Money } from '../../ui/primitives'
import { inRange, type DateRange } from '../../data/calc'
import { useDb } from '../../data/store'
import { useLedger } from '../../data/selectors'
import { date as formatDate } from '../../data/format'
import { CATEGORY_LABEL, type ExpenseCategory, type LedgerSource } from '../../data/types'

const SOURCE_LABEL: Record<LedgerSource, string> = {
  fuel: 'Fuel entry', maintenance: 'Maintenance', driver: 'Driver payment', direct: 'Expense',
}

export interface DrillTarget {
  category: ExpenseCategory
  vehicleId?: string | null
}

export function TransactionsDrawer({
  target, range, onClose,
}: {
  target: DrillTarget | null
  range: DateRange
  onClose: () => void
}) {
  const db = useDb()
  const ledger = useLedger()

  const lines = useMemo(() => {
    if (!target) return []
    return ledger.filter(
      (l) => l.category === target.category
        && inRange(l.date, range)
        && (target.vehicleId == null || l.vehicleId === target.vehicleId),
    )
  }, [ledger, target, range])

  const total = lines.reduce((a, l) => a + l.amount, 0)
  const vehicleName = new Map(db.vehicles.map((v) => [v.id, v.name || v.registrationNumber]))
  const scopedVehicle = target?.vehicleId ? vehicleName.get(target.vehicleId) : null

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target ? CATEGORY_LABEL[target.category] : ''}
      description={
        target
          ? `${lines.length} ${lines.length === 1 ? 'transaction' : 'transactions'} in ${range.label}${scopedVehicle ? ` · ${scopedVehicle}` : ''}`
          : undefined
      }
      width={660}
    >
      <div className="stack stack-6">
        <div className="fline fline-total" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          <span className="fline-label">Total</span>
          <span className="fline-value"><Money value={total} /></span>
        </div>

        {lines.length === 0 ? (
          <p className="section-note">Nothing was recorded under this head in this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="table table-dense">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Recorded as</th>
                  <th scope="col" className="th-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="num">{formatDate(l.date)}</td>
                    <td className="td-strong">{l.description}</td>
                    <td>
                      {l.vehicleId ? (
                        <Link to={`/fleet/vehicles/${l.vehicleId}`} onClick={onClose}>
                          {vehicleName.get(l.vehicleId) ?? '—'}
                        </Link>
                      ) : <span className="t-muted">Unallocated</span>}
                    </td>
                    <td className="t-micro t-muted">{SOURCE_LABEL[l.source]}</td>
                    <td className="td-num"><Money value={l.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
