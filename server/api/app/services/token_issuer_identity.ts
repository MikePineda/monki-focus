// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import type { IssuerProfile } from '@monki-focus/protocol'

export interface TokenIssuerIdentity {
  /** `iss` of every token and part of every implicit assertion: the origin of APP_URL. */
  readonly issuer: string
  /**
   * `release` in production (only `https://host` issuers sign); `development`
   * elsewhere and in the E2E stack, which also signs for loopback http.
   */
  readonly profile: IssuerProfile
}

/** The instance's issuer, derived from APP_URL (no path, port 443 implied for https). */
export function tokenIssuerIdentity(): TokenIssuerIdentity {
  const release = app.inProduction && env.get('E2E_MODE') !== true
  return {
    issuer: new URL(env.get('APP_URL')).origin,
    profile: release ? 'release' : 'development',
  }
}
