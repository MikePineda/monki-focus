// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import './Button.css'
import { Icon, type LucideIcon } from './Icon'

/**
 * - `leave`: the accent fill, 56px, full column width. Reserved for the one
 *   leave/close action of a gate ("Close tab"); never anywhere else.
 * - `ink`: the primary action everywhere else (`ink-1` fill).
 * - `secondary`: the alternative that costs something (hairline border).
 * - `quiet`: inline text action with an underline ("End now").
 */
export type ButtonVariant = 'leave' | 'ink' | 'secondary' | 'quiet'

export interface ButtonProps {
  variant: ButtonVariant
  /** Already translated label. */
  children: ComponentChildren
  icon?: LucideIcon
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Shown under a disabled button and linked as its description. */
  disabledReason?: string
  /** `quiet` only: `muted` (`ink-2`) for "Emergency access". */
  tone?: 'accent' | 'muted'
  autoFocus?: boolean
  onClick?: () => void
}

export function Button({
  variant,
  children,
  icon,
  type = 'button',
  disabled = false,
  disabledReason,
  tone = 'accent',
  autoFocus = false,
  onClick,
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const reasonId = useId()
  const showReason = disabled && Boolean(disabledReason)

  // `autofocus` is ignored on nodes inserted after load, so focus explicitly.
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const classes = ['mf-button', `mf-button--${variant}`]
  if (variant === 'quiet' && tone === 'muted') classes.push('mf-button--muted')

  return (
    <>
      <button
        ref={ref}
        type={type}
        class={classes.join(' ')}
        disabled={disabled}
        aria-describedby={showReason ? reasonId : undefined}
        onClick={onClick}
      >
        {icon ? <Icon icon={icon} /> : null}
        <span class="mf-button__label">{children}</span>
      </button>
      {showReason ? (
        <p id={reasonId} class="mf-button__reason">
          {disabledReason}
        </p>
      ) : null}
    </>
  )
}
