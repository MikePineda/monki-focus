// SPDX-License-Identifier: AGPL-3.0-or-later
import { loadDefaultCategories, loadSiteProfiles, loadSurfaceRegistry } from '@monki-focus/rules'
import { createRulesCatalog } from '../../src/index.ts'
import type { RulesCatalog } from '../../src/index.ts'

let shared: RulesCatalog | undefined

/** The catalog built from the bundled rules data, as an adapter would build it once at start-up. */
export function fixtureCatalog(): RulesCatalog {
  shared ??= createRulesCatalog({
    siteProfiles: loadSiteProfiles().map((file) => file.profile),
    surfaces: loadSurfaceRegistry().surfaces,
    defaultCategories: loadDefaultCategories().assignments,
  })
  return shared
}
