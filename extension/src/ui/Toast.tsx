// SPDX-License-Identifier: AGPL-3.0-or-later
import { Check } from 'lucide-preact'
import { useEffect, useRef } from 'preact/hooks'
import { Icon } from './Icon'
import './Toast.css'

export const TOAST_DURATION_MS = 5_000

export interface ToastProps {
  /** Already translated fact ("Closed. That's 4 closes today."); `null` hides it. */
  message: string | null
  onDismiss: () => void
  /** Auto-dismiss delay; `null` keeps the toast until the caller clears it. */
  durationMs?: number | null
  /** `false` renders in place (dev page) instead of floating bottom centre. */
  floating?: boolean
}

/**
 * A short neutral fact. The `status` region stays mounted while empty so a
 * screen reader announces each new message.
 */
export function Toast({
  message,
  onDismiss,
  durationMs = TOAST_DURATION_MS,
  floating = true,
}: ToastProps) {
  // A new `onDismiss` identity on every parent render must not restart the 5 s.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (message === null || durationMs === null) return undefined
    const timer = setTimeout(() => dismiss.current(), durationMs)
    return () => clearTimeout(timer)
  }, [message, durationMs])

  return (
    <div
      role="status"
      class={floating ? 'mf-toast-region mf-toast-region--floating' : 'mf-toast-region'}
    >
      {message === null ? null : (
        <p class="mf-toast">
          <Icon icon={Check} />
          <span>{message}</span>
        </p>
      )}
    </div>
  )
}
