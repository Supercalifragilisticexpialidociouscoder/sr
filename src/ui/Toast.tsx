/** Transient confirmation that an action landed. */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircleIcon, CheckIcon, InfoIcon } from './icons'

type ToastTone = 'success' | 'error' | 'info'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  body?: string
}

interface ToastApi {
  success: (title: string, body?: string) => void
  error: (title: string, body?: string) => void
  info: (title: string, body?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<ToastTone, ReactNode> = {
  success: <CheckIcon size={16} />,
  error: <AlertCircleIcon size={16} />,
  info: <InfoIcon size={16} />,
}

const LIFETIME = 4200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const handle = timers.current.get(id)
    if (handle) {
      window.clearTimeout(handle)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((tone: ToastTone, title: string, body?: string) => {
    const id = nextId.current++
    // At most three at once: a stack taller than that stops being readable.
    setToasts((prev) => [...prev.slice(-2), { id, tone, title, body }])
    timers.current.set(id, window.setTimeout(() => dismiss(id), LIFETIME))
  }, [dismiss])

  useEffect(() => {
    const handles = timers.current
    return () => { handles.forEach((h) => window.clearTimeout(h)) }
  }, [])

  const api = useMemo<ToastApi>(() => ({
    success: (title, body) => push('success', title, body),
    error: (title, body) => push('error', title, body),
    info: (title, body) => push('info', title, body),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <span className="toast-icon">{ICONS[t.tone]}</span>
              <div className="grow stack stack-2">
                <span className="toast-title">{t.title}</span>
                {t.body && <span className="toast-body">{t.body}</span>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => dismiss(t.id)}
                aria-label={`Dismiss: ${t.title}`}
                style={{ height: 22, paddingInline: 8 }}
              >
                Close
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
