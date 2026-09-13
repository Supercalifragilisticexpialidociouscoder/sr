/** Small shared display components. Every page composes from these. */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { money, moneyPrecise, plate as formatPlate } from '../data/format'
import { ChevronLeftIcon } from './icons'

/* ---------------------------------------------------------------- */
/* Page and section structure                                        */
/* ---------------------------------------------------------------- */

export function PageHeader({
  title, subtitle, actions, back,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className="page-head">
      <div className="page-head-titles">
        {back && (
          <Link to={back.to} className="crumb">
            <ChevronLeftIcon size={13} />
            {back.label}
          </Link>
        )}
        <h1 className="t-title">{title}</h1>
        {subtitle && <div className="t-meta t-secondary">{subtitle}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  )
}

export function Section({
  title, description, actions, children, id,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  id?: string
}) {
  const headingId = id ? `${id}-heading` : undefined
  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section-head">
        <div className="section-head-titles">
          <h2 className="t-section" id={headingId}>{title}</h2>
          {description && <p className="t-micro t-muted">{description}</p>}
        </div>
        {actions && <div className="section-head-actions">{actions}</div>}
      </div>
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

/** Money with optional sign colouring. Renders an em dash when unknown. */
export function Money({
  value, polarity = 'none', precise = false, className = '',
}: {
  value: number | null | undefined
  polarity?: Polarity
  precise?: boolean
  className?: string
}) {
  const v = value == null || !Number.isFinite(value) ? null : value
  if (v == null) return <span className={`unavailable ${className}`}>—</span>
  return (
    <span className={['num', polarityClass(v, polarity), className].filter(Boolean).join(' ')}>
      {precise ? moneyPrecise(v) : money(v)}
    </span>
  )
}

export function Stats({
  children, cols = 4, colsMd = 3, colsSm = 2, className = '',
}: {
  children: ReactNode
  cols?: number
  colsMd?: number
  colsSm?: number
  className?: string
}) {
  return (
    <div
      className={`stats ${className}`}
      style={{
        ['--stat-cols' as string]: cols,
        ['--stat-cols-md' as string]: colsMd,
        ['--stat-cols-sm' as string]: colsSm,
      }}
    >
      {children}
    </div>
  )
}

export function Stat({
  label, value, sub, tone = 'none', hero = false, icon,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: Polarity
  hero?: boolean
  icon?: ReactNode
}) {
  const toneClass = tone === 'positive' ? 't-positive' : tone === 'negative' ? 't-negative' : ''
  return (
    <div className={`stat${hero ? ' stat-hero' : ''}`}>
      <div className="stat-label">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`stat-value ${toneClass}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
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
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="stack stack-3" style={{ alignItems: 'center' }}>
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

/** Page-level loading placeholder that mirrors the shape of a real page. */
export function PageSkeleton() {
  return (
    <div className="page stack stack-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading records</span>
      <div className="stack stack-4">
        <Skeleton width={190} height={24} radius={6} />
        <Skeleton width={280} height={13} radius={4} />
      </div>
      <div className="stats" style={{ ['--stat-cols' as string]: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <Skeleton width={72} height={11} radius={3} />
            <Skeleton width={110} height={21} radius={5} />
          </div>
        ))}
      </div>
      <div className="panel">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="row row-5"
            style={{
              padding: '16px',
              borderBottom: i < 4 ? '1px solid var(--border-faint)' : undefined,
            }}
          >
            <Skeleton width={34} height={34} radius={6} />
            <div className="grow stack stack-3">
              <Skeleton width="42%" height={13} radius={3} />
              <Skeleton width="26%" height={11} radius={3} />
            </div>
            <Skeleton width={84} height={15} radius={4} />
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
