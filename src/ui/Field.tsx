/**
 * Form controls.
 *
 * Every field is labelled, every error is announced, and validation surfaces on
 * blur (or on submit) rather than shouting while the user is still typing.
 */

import {
  useCallback, useId, useMemo, useState,
  type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircleIcon } from './icons'

/* ---------------------------------------------------------------- */
/* Field shell                                                       */
/* ---------------------------------------------------------------- */

export interface FieldShellProps {
  label: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}

export function Field({
  label, required, optional, hint, error, children, className = '',
}: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {required && <span className="field-required" aria-hidden="true">required</span>}
        {optional && <span className="field-optional">optional</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <AlertCircleIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Inputs                                                            */
/* ---------------------------------------------------------------- */

type BaseInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>

export function TextField({
  label, required, optional, hint, error, suffix, prefix, className, ...input
}: FieldShellProps extends never ? never : {
  label: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  suffix?: string
  prefix?: string
  className?: string
} & BaseInput) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => {
        const control = (
          <input
            id={id}
            className={`input${invalid ? ' input-invalid' : ''}`}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-required={required || undefined}
            {...input}
          />
        )
        if (!suffix && !prefix) return control
        return (
          <div className={`input-affix${prefix ? ' input-affix-lead' : ''}`}>
            {control}
            <span className="input-affix-text">{prefix ?? suffix}</span>
          </div>
        )
      }}
    </Field>
  )
}

export interface Option { value: string; label: string; disabled?: boolean }

export function SelectField({
  label, required, optional, hint, error, options, placeholder, className, ...select
}: {
  label: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  options: Option[]
  placeholder?: string
  className?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'>) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          className={`select${invalid ? ' input-invalid' : ''}`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          {...select}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function TextAreaField({
  label, required, optional, hint, error, className, ...area
}: {
  label: string
  required?: boolean
  optional?: boolean
  hint?: ReactNode
  error?: string
  className?: string
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>) {
  return (
    <Field label={label} required={required} optional={optional} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          className={`textarea${invalid ? ' input-invalid' : ''}`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...area}
        />
      )}
    </Field>
  )
}

/**
 * A value the system derived. Deliberately not an input: the user cannot
 * mistype freight or a fuel total, and the formula is shown so the number is
 * never a black box.
 */
export function ComputedField({
  label, value, formula, action,
}: {
  label: string
  value: ReactNode
  formula?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="field">
      <span className="field-label">
        {label}
        <span className="field-optional">calculated</span>
      </span>
      <div className="field-computed">
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <span className="field-computed-value">{value}</span>
          {formula && <span className="field-computed-formula">{formula}</span>}
        </div>
        {action}
      </div>
    </div>
  )
}

/** Segmented radio group — faster than a select for 2–4 known choices. */
export function ChoiceField({
  label, value, onChange, options, required, hint, error, name,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  required?: boolean
  hint?: ReactNode
  error?: string
  name: string
}) {
  const groupId = useId()
  return (
    <div className="field" role="radiogroup" aria-labelledby={groupId} aria-required={required || undefined}>
      <span className="field-label" id={groupId}>
        {label}
        {required && <span className="field-required" aria-hidden="true">required</span>}
      </span>
      <div className="choice-group">
        {options.map((o) => (
          <label key={o.value} className={`choice${value === o.value ? ' choice-on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          <AlertCircleIcon size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* Form state                                                        */
/* ---------------------------------------------------------------- */

export type Errors<T> = Partial<Record<keyof T, string>>

/**
 * Minimal form state with blur-then-submit validation.
 *
 * Errors are computed from values on every render, so a field clears the
 * moment it becomes valid — but only fields the user has left, or every field
 * once they have tried to submit, actually display one.
 */
export function useFormState<T extends object>(
  initial: T,
  validate: (values: T) => Errors<T>,
) {
  const [values, setValues] = useState<T>(initial)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const errors = useMemo(() => validate(values), [values, validate])
  const isValid = Object.keys(errors).length === 0

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const patch = useCallback((next: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...next }))
  }, [])

  const blur = useCallback((key: keyof T) => {
    setTouched((prev) => ({ ...prev, [key as string]: true }))
  }, [])

  const errorFor = useCallback(
    (key: keyof T): string | undefined =>
      submitAttempted || touched[key as string] ? errors[key] : undefined,
    [errors, submitAttempted, touched],
  )

  /** Returns true when the form is valid and the caller may proceed. */
  const attemptSubmit = useCallback((): boolean => {
    setSubmitAttempted(true)
    return Object.keys(validate(values)).length === 0
  }, [validate, values])

  /** Wires a text-like field to state in one call. */
  const field = useCallback(
    <K extends keyof T>(key: K) => ({
      value: values[key] as unknown as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        set(key, e.target.value as unknown as T[K]),
      onBlur: () => blur(key),
      error: errorFor(key),
    }),
    [values, set, blur, errorFor],
  )

  return { values, set, patch, field, blur, errors, errorFor, isValid, attemptSubmit, submitAttempted }
}

/* ---------------------------------------------------------------- */
/* Validators                                                        */
/* ---------------------------------------------------------------- */

export const required = (value: string | null | undefined, what: string): string | undefined =>
  value == null || String(value).trim() === '' ? `${what} is required` : undefined

export const positiveNumber = (
  value: string | number, what: string, { allowZero = false } = {},
): string | undefined => {
  if (value === '' || value == null) return `${what} is required`
  const n = Number(value)
  if (!Number.isFinite(n)) return `${what} must be a number`
  if (n < 0) return `${what} cannot be negative`
  if (!allowZero && n === 0) return `${what} must be more than zero`
  return undefined
}

export const validDate = (value: string, what: string): string | undefined => {
  if (!value) return `${what} is required`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `Enter ${what.toLowerCase()} as a valid date`
  return undefined
}

export function num(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
