/** Shared display components. Every page composes from these. */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { money, moneyPrecise, plate as formatPlate } from '../data/format'
import { ChevronLeftIcon } from './icons'

/* ---------------------------------------------------------------- */
/* Page and section structure                                        */
/* ---------------------------------------------------------------- */

export function PageHeader({
  title, meta, actions, back,
}: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className="page-head">
      <div className="page-head-titles">
        {back && (
          <Link to={back.to} className="crumb">
            <ChevronLeftIcon size={12} />
            {back.label}
          </Link>
        )}
        <h1 className="t-title">{title}</h1>
        {meta && <div className="t-micro t-muted row row-4 row-wrap">{meta}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  )
}

/**
 * A tracked label, a rule that runs across to the actions, and the actions.
 *
 * Deliberately not a bold heading over a paragraph of explanation: the label
 * names the section and the content speaks for itself. `note` exists for the
 * few places where an accounting rule genuinely needs stating.
 */
export function Section({
  title, count, actions, note, children, id,
}: {
  title: string
  count?: number | string
  actions?: ReactNode
  note?: ReactNode
  children: ReactNode
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section-head">
        <h2 className="section-head-label" id={headingId}>{title}</h2>
        {count != null && <span className="section-head-count">{count}</span>}
        <span className="section-rule" aria-hidden="true" />
        {actions && <div className="section-head-actions">{actions}</div>}
      </div>
      {note && <p className="section-note">{note}</p>}
      {children}
    </section>
  )
}

/* ---------------------------------------------------------------- */
/* Figures                                                           */
/* ---------------------------------------------------------------- */

export type Polarity = 'auto' | 'positive' | 'negative' | 'none'

function polarityClass(value: number | null, polarity: Polarity): string {
  if (polarity === 'none') return ''
  if (polarity === 'positive') return 't-positive'
  if (polarity === 'negative') return 't-negative'
  if (value == null) return ''
  if (value > 0) return 't-positive'
  if (value < 0) return 't-negative'
  return ''
}

/**
 * Money.
 *
 * At display size the currency mark is set smaller and quieter than the
 * figure it qualifies — the number is what is being read.
 */
export function Money({
  value, polarity = 'none', precise = false, display = false, className = '',
}: {
  value: number | null | undefined
  polarity?: Polarity
  precise?: boolean
  display?: boolean
  className?: string
}) {
  const v = value == null || !Number.isFinite(value) ? null : value
  if (v == null) return <span className={`unavailable ${className}`}>—</span>

  const text = precise ? moneyPrecise(v) : money(v)
  const cls = ['num', polarityClass(v, polarity), className].filter(Boolean).join(' ')

  if (!display) return <span className={cls}>{text}</span>

  const at = text.indexOf('₹')
  return (
    <span className={cls}>
      {text.slice(0, at)}
      <span className="rupee">₹</span>
      {text.slice(at + 1)}
    </span>
  )
}

/**
 * The readout: one leading figure and the ledger that qualifies it.
 *
 * This is what the product uses instead of a row of metric cards. Exactly one
 * figure per view is allowed to be large; everything else is a ledger line.
 */
export function Readout({
  label, value, note, tone = 'none', children,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Polarity
  children: ReactNode
}) {
  const toneClass = tone === 'positive' ? 't-positive' : tone === 'negative' ? 't-negative' : ''
  return (
    <div className="readout">
      <div className="readout-hero">
        <span className="t-label">{label}</span>
        <span className={`readout-hero-value ${toneClass}`}>{value}</span>
        {note && <span className="readout-hero-note">{note}</span>}
      </div>
      <div className="readout-ledger">{children}</div>
    </div>
  )
}

export function Figures({
  cols = 1, children, className = '',
}: {
  cols?: 1 | 2 | 3 | 4
  children: ReactNode
  className?: string
}) {
  const colClass = cols === 1 ? '' : `figures-${cols}`
  return <div className={`figures ${colClass} ${className}`.trim()}>{children}</div>
}

/** One ledger line: label on the left, figure on the right, hairline between. */
export function Figure({
  label, value, sub, total = false,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  total?: boolean
}) {
  return (
    <div className={`fline${total ? ' fline-total' : ''}`}>
      <span className="fline-label truncate">{label}</span>
      <span className="fline-value">
        {sub && <span className="fline-sub">{sub}</span>}
        {value}
      </span>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Identity                                                          */
/* ---------------------------------------------------------------- */

export function Plate({ value, large = false }: { value: string; large?: boolean }) {
  return <span className={`plate${large ? ' plate-lg' : ''}`}>{formatPlate(value)}</span>
}

export function Avatar({ initials, large = false }: { initials: string; large?: boolean }) {
  return <span className={`avatar${large ? ' avatar-lg' : ''}`} aria-hidden="true">{initials}</span>
}

/** A trip drawn as what it is: a line from one place to another. */
export function Route({ from, to }: { from: string; to: string }) {
  return (
    <span className="route">
      <span className="route-stop truncate">{from}</span>
      <span className="route-link" aria-hidden="true" />
      <span className="route-stop truncate">{to}</span>
    </span>
  )
}

/* ---------------------------------------------------------------- */
/* Badges                                                            */
/* ---------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | 'info'

export function Badge({
  tone = 'neutral', dot = false, children,
}: {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- */
/* States                                                            */
/* ---------------------------------------------------------------- */

export function EmptyState({
  icon, title, body, action, compact = false,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty${compact ? ' empty-compact' : ''}`}>
      {icon && <span className="empty-icon">{icon}</span>}
      <div className="stack stack-3">
        <p className="empty-title">{title}</p>
        {body && <p className="empty-body">{body}</p>}
      </div>
      {action}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 14, radius }: {
  width?: number | string
  height?: number | string
  radius?: number
}) {
  return (
    <span
      className="skeleton"
      aria-hidden="true"
      style={{ display: 'block', width, height, borderRadius: radius }}
    />
  )
}

/** Mirrors the shape of a real page so nothing jumps when records land. */
export function PageSkeleton() {
  return (
    <div className="page stack stack-9" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records</span>
      <div className="stack stack-4">
        <Skeleton width={150} height={22} radius={4} />
        <Skeleton width={260} height={12} radius={3} />
      </div>
      <div className="readout">
        <div className="readout-hero">
          <Skeleton width={90} height={11} radius={2} />
          <Skeleton width={210} height={42} radius={6} />
        </div>
        <div className="readout-ledger stack stack-5">
          {[0, 1, 2, 3].map((i) => (
            <div className="row row-between" key={i} style={{ gap: 16 }}>
              <Skeleton width={84} height={11} radius={2} />
              <Skeleton width={70} height={13} radius={2} />
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="row row-5"
            style={{ padding: '20px 24px', borderBottom: i < 2 ? '1px solid var(--border-faint)' : undefined }}
          >
            <div className="grow stack stack-3">
              <Skeleton width="34%" height={14} radius={3} />
              <Skeleton width="22%" height={11} radius={3} />
            </div>
            <Skeleton width={80} height={14} radius={3} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="page">
      <EmptyState
        title="Something went wrong"
        body={message}
        action={onRetry ? (
          <button className="btn btn-secondary" type="button" onClick={onRetry}>Try again</button>
        ) : undefined}
      />
    </div>
  )
}
