// SPDX-License-Identifier: AGPL-3.0-or-later
import './LevelDot.css'
import type { LevelIndex } from './LevelIndex'

export interface LevelDotProps {
  /** A level, or `uncategorised` for time without a category. */
  level: LevelIndex | 'uncategorised'
}

/**
 * The 8px legend key of a level. Decorative: it always sits next to the
 * level name, so colour is never the only carrier of meaning.
 */
export function LevelDot({ level }: LevelDotProps) {
  return <span class="mf-level-dot" data-level={level} aria-hidden="true" />
}
