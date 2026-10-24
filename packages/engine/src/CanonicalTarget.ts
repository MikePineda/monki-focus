// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The identity of a target after §3.1 normalisation, as the validator's
 * `x-uniqueBy` compares it (SEMANTICS.md §1): normalised domain, lower-cased
 * glob (globs compare case-insensitively) and `/**` as no path. Two targets
 * with the same key are the same target.
 */
import type { Target } from '@monki-focus/rules'
import { CATCH_ALL_GLOB } from './PathGlob.ts'
import type { RulesCatalog } from './RulesCatalog.ts'

export function canonicalTargetKey(target: Target, catalog: RulesCatalog): string {
  switch (target.kind) {
    case 'app':
      return `app:${target.package}`
    case 'surface':
      return `surface:${target.surface}`
    case 'site': {
      const path =
        target.path === undefined || target.path === CATCH_ALL_GLOB ? '' : target.path.toLowerCase()
      return `site:${catalog.normaliseDomain(target.domain)}${path}`
    }
  }
}
