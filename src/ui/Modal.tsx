/**
 * Accessible dialog.
 *
 * On desktop it is a centred panel; on a phone it becomes a bottom sheet (see
 * `.modal` in components.css). Both are the same dialog: focus is trapped while
 * open, Escape closes, the page behind cannot scroll, and focus returns to
 * whatever opened it.
 */

import {
  useCallback, useEffect, useId, useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button'
import { CloseIcon } from './icons'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Max width in px for the desktop panel. */
  width?: number
  /** Set false when a half-typed form should not be lost to a stray click. */
  closeOnOverlay?: boolean
}

export function Modal({
  open, onClose, title, description, children, footer, width = 600, closeOnOverlay = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  /* Focus management -------------------------------------------------- */
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null

    // Focus the first real control, not the close button — the user came here
    // to fill something in.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const candidates = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
      const first = [...candidates].find((el) => !el.hasAttribute('data-dialog-dismiss'))
      ;(first ?? panel).focus()
    })

    return () => {
      cancelAnimationFrame(frame)
      restoreRef.current?.focus?.()
    }
  }, [open])

  /* Scroll lock — compensating for the scrollbar so the page does not jump. */
  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
    }
  }, [open])

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [onClose])

  if (!open) return null

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (closeOnOverlay && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        style={{ ['--modal-w' as string]: `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="modal-head">
          <div className="stack stack-2" style={{ minWidth: 0 }}>
            <h2 className="t-section" id={titleId}>{title}</h2>
            {description && <p className="t-micro t-muted" id={descId}>{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} data-dialog-dismiss="">
            <CloseIcon size={16} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/**
 * A dialog wrapping a form. Submitting with Enter works because the panel
 * contents are a real `<form>`, not a div with a click handler.
 */
export function FormModal({
  open, onClose, title, description, onSubmit, submitLabel = 'Save',
  submitDisabled, children, width, destructive,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  onSubmit: () => void
  submitLabel?: string
  submitDisabled?: boolean
  children: ReactNode
  width?: number
  destructive?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={width}
      closeOnOverlay={false}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form={`form-${title.replace(/\W+/g, '-')}`}
            className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`}
            disabled={submitDisabled}
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <form
        id={`form-${title.replace(/\W+/g, '-')}`}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {children}
      </form>
    </Modal>
  )
}
