// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren } from 'preact'
import { useId } from 'preact/hooks'

export interface DevSectionProps {
  title: string
  children: ComponentChildren
}

/** One component's spot in a gallery panel. */
export function DevSection({ title, children }: DevSectionProps) {
  const id = useId()
  return (
    <section class="dev-section" aria-labelledby={id}>
      <h3 id={id} class="dev-section__title">
        {title}
      </h3>
      <div class="dev-section__body">{children}</div>
    </section>
  )
}
