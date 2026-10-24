// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Position on the five-step focus scale, in fixed order: 0 Distracting,
 * 1 Personal, 2 Neutral, 3 Other work, 4 Focus (category levels 0, 25, 50,
 * 75 and 100). It picks the `--mf-level-<n>` mark colour and the
 * `level.<n>` name; a filter never repaints a level.
 */
export const LEVEL_INDICES = [0, 1, 2, 3, 4] as const
export type LevelIndex = (typeof LEVEL_INDICES)[number]

/** Tracked minutes per level, indexed by LevelIndex. */
export type MinutesByLevel = readonly [number, number, number, number, number]

export function levelNameKey(level: LevelIndex) {
  return `level.${level}` as const
}
