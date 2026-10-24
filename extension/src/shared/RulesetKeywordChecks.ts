// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  aliasMapOf,
  canonicalTarget,
  isRegistrableDomain,
  siteProfiles,
} from '@monki-focus/rules/pure'

// Built here, not imported as `bundledAliasMap`: that module also builds the
// run-time Ajv validator, whose code generator must never ship (MV3 CSP).
const bundledAliasMap = aliasMapOf(siteProfiles)

/**
 * Run-time checks of the rules schemas' custom keywords (`x-uniqueBy`,
 * `x-registrableDomain`, `x-timeZone`, SEMANTICS.md §1) for the validator
 * generated at build time (`config/rulesetValidatorPlugin.ts`). They mirror
 * the keyword functions of `@monki-focus/rules` `createSchemaValidator`
 * over the bundled site aliases; the `invalid` fixtures prove both agree.
 */

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function valueAt(item: unknown, pointer: string): unknown {
  let current = item
  for (const segment of pointer.split('/').slice(1)) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/** Same rule as the rules package: an unknown zone, or one differing only by case, fails. */
function isResolvableTimeZone(zone: string): boolean {
  let resolved: string
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone
  } catch {
    return false
  }
  return resolved === zone || resolved.toLowerCase() !== zone.toLowerCase()
}

export const rulesetKeywordChecks = {
  uniqueBy(pointer: string, items: unknown[]): boolean {
    const keys = items.map((item) =>
      canonicalJson(canonicalTarget(valueAt(item, pointer), bundledAliasMap))
    )
    return new Set(keys).size === keys.length
  },
  registrableDomain(enabled: boolean, domain: string): boolean {
    return !enabled || isRegistrableDomain(domain, bundledAliasMap)
  },
  timeZone(enabled: boolean, zone: string): boolean {
    return !enabled || isResolvableTimeZone(zone)
  },
} as const
