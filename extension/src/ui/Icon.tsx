// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LucideIcon } from 'lucide-preact'

export type { LucideIcon }

export interface IconProps {
  icon: LucideIcon
  /** 20px on pages, 16px in the popup (DESIGN.md "Shapes"). */
  size?: 16 | 20
  class?: string
}

/**
 * A Lucide glyph drawn the one way the design allows: 1.75px stroke in
 * `currentColor`. Icons always sit next to a word, so they are decorative
 * and hidden from assistive technology.
 */
export function Icon({ icon: Glyph, size = 20, class: className }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      focusable="false"
      class={className ? `mf-icon ${className}` : 'mf-icon'}
    />
  )
}
