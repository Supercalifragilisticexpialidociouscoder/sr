import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, IconButton } from '../../../ui/Button'
import { Badge, EmptyState, Figure, Figures, Money, Section } from '../../../ui/primitives'
import { DataTable, type Column } from '../../../ui/DataTable'
import { BarList } from '../../../ui/Charts'
import { useConfirm } from '../../../ui/Confirm'
import { useToast } from '../../../ui/Toast'
import { useForms } from '../../forms/FormsProvider'
import { Ratio } from '../../shared'
import { useStore } from '../../../data/store'
import { safeDiv } from '../../../data/calc'
import { date as formatDate, money, percent } from '../../../data/format'
import {
  CATEGORY_LABEL, PAYMENT_METHOD_LABEL,
  type ExpenseCategory, type LedgerLine, type LedgerSource,
} from '../../../data/types'
import { EditIcon, PlusIcon, ReceiptIcon, TrashIcon } from '../../../ui/icons'
import type { TabProps } from '../types'

const SOURCE_LABEL: Record<LedgerSource, string> = {
  fuel: 'Fuel entry', maintenance: 'Maintenance', driver: 'Driver payment', direct: 'Expense',
}

export function ExpensesTab({ vehicle, records, summary }: TabProps) {
  const { db, dispatch } = useStore()
  const confirm = useConfirm()
  const toast = useToast()
  const { openForm } = useForms()
  const navigate = useNavigate()

  const lines = records.ledger

  /* Ranked category breakdown. Bar length carries the magnitude and the row
     label carries the identity, so one colour is the honest choice — varying
     it by rank would repaint the rows whenever the order changed. */
  const breakdown = useMemo(() => {
    const entries = (Object.entries(summary.byCategory) as [ExpenseCategory, number][])
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
    return entries.map(([category, amount]) => ({
      id: category,
      label: CATEGORY_LABEL[category],
      value: amount,
      display: money(amount),
      meta: summary.expenses > 0 ? `${percent(amount / summary.expenses, 1)} of total expenses` : undefined,
    }))
  }, [summary.byCategory, summary.expenses])

  const removeDirect = async (line: LedgerLine) => {
    const ok = await confirm({
      title: 'Delete this expense?',
      body: `${money(line.amount)} — ${line.description} on ${formatDate(line.date)}. ${vehicle.name}'s expenses and profit will be recalculated.`,
      confirmLabel: 'Delete expense',
      destructive: true,
    })
    if (!ok) return
    dispatch({ type: 'expense/remove', id: line.sourceId })
    toast.success('Expense deleted')
  }

  const openSource = (line: LedgerLine) => {
    if (line.source === 'direct') {
      const expense = db.expenses.find((e) => e.id === line.sourceId)
      if (expense) openForm({ kind: 'expense', edit: expense })
      return
    }
    if (line.source === 'fuel') navigate(`/fleet/vehicles/${vehicle.id}/fuel`)
    else if (line.source === 'maintenance') navigate(`/fleet/vehicles/${vehicle.id}/maintenance`)
    else navigate(`/fleet/vehicles/${vehicle.id}/drivers`)
  }

  const columns: Column<LedgerLine>[] = [
    {
      key: 'date', header: 'Date', mobile: 'meta',
      render: (l) => <span className="num t-secondary">{formatDate(l.date)}</span>,
    },
    {
      key: 'description', header: 'Description', mobile: 'title',
      render: (l) => <span className="td-strong truncate">{l.description}</span>,
    },
    {
      key: 'category', header: 'Category',
      render: (l) => <Badge>{CATEGORY_LABEL[l.category]}</Badge>,
    },
    {
      key: 'source', header: 'Recorded as',
      render: (l) => <span className="t-micro t-muted">{SOURCE_LABEL[l.source]}</span>,
    },
    {
      key: 'method', header: 'Paid by',
      render: (l) => <span className="t-secondary">{PAYMENT_METHOD_LABEL[l.paymentMethod]}</span>,
    },
    {
      key: 'amount', header: 'Amount', numeric: true, mobile: 'amount',
      render: (l) => <Money value={l.amount} className="td-strong" />,
    },
    {
      key: 'actions', header: '', numeric: true, width: '92px',
      render: (l) => (
        <span className="row row-2 row-end">
          <IconButton
            label={l.source === 'direct' ? `Edit ${l.description}` : `Open the ${SOURCE_LABEL[l.source].toLowerCase()} this came from`}
            size="sm"
            onClick={() => openSource(l)}
          >
            <EditIcon size={14} />
          </IconButton>
          {l.source === 'direct' && (
            <IconButton label={`Delete ${l.description}`} size="sm" onClick={() => removeDirect(l)}>
              <TrashIcon size={14} />
            </IconButton>
          )}
        </span>
      ),
    },
  ]

  const perTrip = safeDiv(summary.expenses, summary.trips)

  return (
    <div className="stack stack-9">
      <Section
        id="v-expense-summary"
        title="Where the money went"
        actions={
          <Button size="sm" variant="primary" icon={<PlusIcon size={14} />} onClick={() => openForm({ kind: 'expense', vehicleId: vehicle.id })}>
            Add expense
          </Button>
        }
      >
        {lines.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon size={20} />}
            title="No expenses in this period"
            body={`Tolls, FASTag recharges, insurance and permits are added here. Diesel, maintenance and driver payments reach this ledger automatically from their own records.`}
            action={
              <Button variant="primary" icon={<PlusIcon size={15} />} onClick={() => openForm({ kind: 'expense', vehicleId: vehicle.id })}>
                Add expense
              </Button>
            }
          />
        ) : (
          <>
            <Figures cols={2} className="panel panel-pad">
              <Figure label="Total expenses" value={<Money value={summary.expenses} />} sub={`${lines.length} ledger lines`} />
              <Figure label="Cost per km" value={<Ratio value={summary.costPerKm} />} />
              <Figure label="Cost per tonne" value={<Ratio value={summary.costPerTon} />} />
              <Figure label="Cost per trip" value={<Ratio value={perTrip} />} />
            </Figures>
            <div className="panel panel-pad">
              <BarList items={breakdown} />
            </div>
          </>
        )}
      </Section>

      {lines.length > 0 && (
        <Section
          id="v-expense-ledger"
          title="Expense ledger"
        >
          <DataTable
            rows={lines}
            columns={columns}
            getKey={(l) => l.id}
            dense
            caption={`Expense ledger for ${vehicle.name}`}
          />
        </Section>
      )}
    </div>
  )
}
