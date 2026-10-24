// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IncognitoAccess } from '../../shared/StatsContract'

export interface IncognitoExtensionApi {
  isAllowedIncognitoAccess(): Promise<boolean>
}

/**
 * Whether the user allowed the extension in incognito windows. Without it,
 * incognito browsing is neither hidden nor tracked, so the popup warns.
 * When it is allowed, incognito time counts by domain only (no path, no
 * title; see `ActiveTabProbe`).
 */
export class IncognitoAccessCheck {
  constructor(private readonly extension: IncognitoExtensionApi) {}

  async check(): Promise<IncognitoAccess> {
    return { allowed: await this.extension.isAllowedIncognitoAccess() }
  }
}
