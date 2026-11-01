// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Relaxed-weekend changes (SEMANTICS.md §8): turning relaxed weekends off (or
 * leaving the setting as it is) tightens and applies at once; turning it on
 * loosens and waits. An absent setting counts as disabled.
 */
import type { Ruleset } from '@monki-focus/rules'

export function relaxedWeekendsChangeWaits(
  previous: Pick<Ruleset, 'relaxedWeekends'>,
  next: Pick<Ruleset, 'relaxedWeekends'>
): boolean {
  const wasOn = previous.relaxedWeekends?.enabled === true
  const isOn = next.relaxedWeekends?.enabled === true
  return isOn && !wasOn
}
