// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CategoryLevel } from '@monki-focus/analytics'
import type { SecondsByLevelIndex, StatsLevelIndex } from '../../shared/StatsContract'

/** Analytics level (0, 25, 50, 75, 100) as the UI's index 0..4. */
export function levelIndexOf(level: CategoryLevel): StatsLevelIndex {
  return (level / 25) as StatsLevelIndex
}

export function emptySecondsByLevel(): SecondsByLevelIndex {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
}
