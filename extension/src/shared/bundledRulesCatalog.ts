// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRulesCatalog, type RulesCatalog } from '@monki-focus/engine'
import { defaultCategories, siteProfiles, surfaceRegistry } from '@monki-focus/rules/pure'

let shared: RulesCatalog | undefined

/**
 * The engine catalog over the rules data bundled into the extension (site
 * profiles, the surface registry and the default categories). Built once per
 * context: the service worker decides with it and the feed guard uses it to
 * know, before the first decision arrives, whether the page is a feed.
 */
export function bundledRulesCatalog(): RulesCatalog {
  shared ??= createRulesCatalog({
    siteProfiles,
    surfaces: surfaceRegistry.surfaces,
    defaultCategories: defaultCategories.assignments,
  })
  return shared
}
