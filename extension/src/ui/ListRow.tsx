// SPDX-License-Identifier: AGPL-3.0-or-later
import { ChevronRight } from 'lucide-preact'
import { Icon, type LucideIcon } from './Icon'
import { LevelDot } from './LevelDot'
import type { LevelIndex } from './LevelIndex'
import './ListRow.css'

export type ListRowLeading = { icon: LucideIcon } | { level: LevelIndex }

export interface ListRowProps {
  /** Already translated texts. */
  primary: string
  secondary?: string
  /** A value in tabular figures ("42 min"); interactive rows show a chevron instead. */
  trailing?: string
  leading?: ListRowLeading
  /** Makes the row a button. */
  onClick?: () => void
  /** Makes the row a link. */
  href?: string
  /** `compact`: `body-sm` primary text in the popup. */
  density?: 'default' | 'compact'
}

/** One row of a hairline-separated list (`<ul>`); never a card. */
export function ListRow({
  primary,
  secondary,
  trailing,
  leading,
  onClick,
  href,
  density = 'default',
}: ListRowProps) {
  const interactive = Boolean(onClick ?? href)
  const content = (
    <>
      {leading ? (
        'icon' in leading ? (
          <Icon icon={leading.icon} class="mf-list-row__leading" />
        ) : (
          <LevelDot level={leading.level} />
        )
      ) : null}
      <span class="mf-list-row__text">
        <span class="mf-list-row__primary">{primary}</span>
        {secondary ? <span class="mf-list-row__secondary">{secondary}</span> : null}
      </span>
      {trailing ? <span class="mf-list-row__trailing">{trailing}</span> : null}
      {interactive && !trailing ? <Icon icon={ChevronRight} class="mf-list-row__chevron" /> : null}
    </>
  )

  return (
    <li class={`mf-list-row mf-list-row--${density}`}>
      {href ? (
        <a class="mf-list-row__body mf-list-row__body--interactive" href={href}>
          {content}
        </a>
      ) : onClick ? (
        <button
          type="button"
          class="mf-list-row__body mf-list-row__body--interactive"
          onClick={onClick}
        >
          {content}
        </button>
      ) : (
        <div class="mf-list-row__body">{content}</div>
      )}
    </li>
  )
}
