/**
 * Confirmation dialog.
 *
 * Deletions cascade — removing a vehicle takes its trips, fuel and expenses
 * with it — so the copy always names what else goes, never just "are you sure?".
 */

import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { Modal } from './Modal'

interface ConfirmRequest {
  title: string
  body: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((next) => {
    setRequest(next)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setRequest(null)
  }, [])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={request !== null}
        onClose={() => settle(false)}
        title={request?.title ?? ''}
        width={460}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
              {request?.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={`btn ${request?.destructive ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
            >
              {request?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <p className="t-meta t-secondary" style={{ lineHeight: 1.6 }}>{request?.body}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx
}
