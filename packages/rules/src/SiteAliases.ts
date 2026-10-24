// SPDX-License-Identifier: AGPL-3.0-or-later
import type { AliasMap } from './TargetNormaliser.ts'

/** Alias domain → canonical domain of a set of site profiles (`twitter.com` → `x.com`). */
export function aliasMapOf(
  profiles: readonly { domain: string; aliases?: readonly string[] }[]
): AliasMap {
  const aliases: Record<string, string> = {}
  for (const profile of profiles) {
    for (const alias of profile.aliases ?? []) aliases[alias] = profile.domain
  }
  return aliases
}
