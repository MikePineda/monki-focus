// SPDX-License-Identifier: AGPL-3.0-or-later
import { defaultCategories, siteProfiles, surfaceRegistry } from '@monki-focus/rules/pure'
import { createRulesCatalog } from '../../src/index.ts'
import type { RulesCatalog } from '../../src/index.ts'

let shared: RulesCatalog | undefined

/**
 * The catalog built from the bundled rules data through the browser-safe
 * entry point, as the extension service worker builds it once at start-up.
 */
export function fixtureCatalog(): RulesCatalog {
  shared ??= createRulesCatalog({
    siteProfiles,
    surfaces: surfaceRegistry.surfaces,
    defaultCategories: defaultCategories.assignments,
  })
  return shared
}
