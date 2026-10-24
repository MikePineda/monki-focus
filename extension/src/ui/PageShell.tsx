// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ComponentChildren } from 'preact'
import './PageShell.css'

export interface PageShellProps {
  /** Already translated page heading. */
  title: string
  children?: ComponentChildren
}

/** Common frame of the extension pages: one heading, then the page body. */
export function PageShell({ title, children }: PageShellProps) {
  return (
    <main class="page-shell">
      <h1 class="page-shell__title">{title}</h1>
      {children}
    </main>
  )
}
