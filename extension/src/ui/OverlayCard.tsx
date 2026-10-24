// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren, TargetedKeyboardEvent } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import './OverlayCard.css'

export interface OverlayCardProps {
  /** Already translated context line ("news.example · 10 min"). */
  context?: string
  /** Already translated title; names the dialog. */
  title: string
  /** The actions: the Leave button first (it takes initial focus). */
  children: ComponentChildren
  /** Already translated cost note under the actions. */
  note?: string
  /**
   * Render in place, without the scrim, focus trap or initial focus (the
   * dev page shows several cards at once).
   */
  preview?: boolean
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The timeout card over a dimmed page. Leaving is a choice, not a dismissal:
 * there is no close button and `Esc` does nothing. Focus starts on the first
 * action and Tab cycles inside the card. It works the same inside a shadow
 * root, where the content-script overlay mounts it.
 */
export function OverlayCard({ context, title, children, note, preview = false }: OverlayCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const titleId = `${id}-title`
  const noteId = `${id}-note`

  useEffect(() => {
    if (preview) return
    cardRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [preview])

  const handleKeyDown = (event: TargetedKeyboardEvent<HTMLDivElement>) => {
    if (preview) return
    if (event.key === 'Escape') {
      event.preventDefault()
      return
    }
    if (event.key !== 'Tab') return
    const focusables = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = focusables[0]
    const last = focusables.at(-1)
    if (!first || !last) return
    const active = (event.currentTarget.getRootNode() as Document | ShadowRoot).activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div class={preview ? 'mf-overlay mf-overlay--preview' : 'mf-overlay'}>
      <div
        ref={cardRef}
        class="mf-overlay__card"
        role="dialog"
        aria-modal={preview ? undefined : 'true'}
        aria-labelledby={titleId}
        aria-describedby={note ? noteId : undefined}
        onKeyDown={handleKeyDown}
      >
        {context ? <p class="mf-overlay__context">{context}</p> : null}
        <h2 id={titleId} class="mf-overlay__title">
          {title}
        </h2>
        <div class="mf-overlay__actions">{children}</div>
        {note ? (
          <p id={noteId} class="mf-overlay__note">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  )
}
