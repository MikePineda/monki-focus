// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren } from 'preact'
import './VisuallyHidden.css'

export interface VisuallyHiddenProps {
  id?: string
  children?: ComponentChildren
}

/** Text for assistive technology only (the word next to a status icon, ...). */
export function VisuallyHidden({ id, children }: VisuallyHiddenProps) {
  return (
    <span id={id} class="mf-visually-hidden">
      {children}
    </span>
  )
}
