// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ruleset } from '@monki-focus/rules/pure'
import { SITE_HOST_PERMISSIONS } from '../../config/extensionManifest'

/** The match pattern that covers a domain and its subdomains. */
export function originPatternOf(domain: string): string {
  return `*://*.${domain.toLowerCase()}/*`
}

/**
 * Host permissions the extension needs for `ruleset`: the bundled sites
 * plus every site an enabled restrictive rule targets. Without them the
 * rules cannot reach those pages (the popup warns, the editor asks).
 */
export function requiredOrigins(ruleset: Ruleset | null): string[] {
  const origins = new Set<string>(SITE_HOST_PERMISSIONS)
  for (const rule of ruleset?.rules ?? []) {
    if (rule.enabled && rule.mode !== 'allow' && rule.target.kind === 'site') {
      origins.add(originPatternOf(rule.target.domain))
    }
  }
  return [...origins]
}

/** The slice of `browser.permissions` the pages use. */
export interface PermissionsApi {
  contains(permissions: { origins: string[] }): Promise<boolean>
  request(permissions: { origins: string[] }): Promise<boolean>
}

/** The origins of `origins` the browser does not grant (checked one by one). */
export async function missingOrigins(
  permissions: PermissionsApi,
  origins: readonly string[]
): Promise<string[]> {
  const granted = await Promise.all(
    origins.map((origin) => permissions.contains({ origins: [origin] }).catch(() => true))
  )
  return origins.filter((_origin, index) => !granted[index])
}
