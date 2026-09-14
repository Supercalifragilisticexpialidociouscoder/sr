import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZE: Record<Size, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' }

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary', size = 'md', block, icon, children, className = '', type = 'button', ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={['btn', VARIANT[variant], SIZE[size], block ? 'btn-block' : '', className]
        .filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

/** Icon-only button. `label` is required — it becomes the accessible name. */
export function IconButton({
  label, size = 'md', children, className = '', type = 'button', ...rest
}: Omit<ButtonProps, 'icon' | 'variant'> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={['btn', 'btn-icon', size === 'sm' ? 'btn-icon-sm' : '', className]
        .filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}

export function LinkButton({
  to, variant = 'secondary', size = 'md', block, icon, children, className = '',
}: {
  to: string
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={['btn', VARIANT[variant], SIZE[size], block ? 'btn-block' : '', className]
        .filter(Boolean).join(' ')}
    >
      {icon}
      {children}
    </Link>
  )
}
