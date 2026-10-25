// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { judgeClientVersion, type ClientMinimums } from '#domain/clients/client_version_gate'

/** The minimums configured on this instance (`MIN_CLIENT_VERSION_*`). */
export function configuredClientMinimums(): ClientMinimums {
  return {
    chrome_extension: env.get('MIN_CLIENT_VERSION_EXTENSION'),
    android: env.get('MIN_CLIENT_VERSION_ANDROID'),
    macos: env.get('MIN_CLIENT_VERSION_MACOS'),
  }
}

/**
 * Device API gate (named middleware `clientVersion`, on `/api/v1/device/*`):
 * every request carries `X-Client-Version: <platform>/<semver>`.
 *
 * - malformed or missing: 422 `{ code: 'validation_failed', fields }`
 * - older than MIN_CLIENT_VERSION_<platform>: 426
 *   `{ code: 'client_upgrade_required', minimumVersion }` (the contract's
 *   `UpgradeRequiredError`); the client keeps enforcing locally.
 *
 * Reason codes only, no text: clients map codes to their own catalogs.
 */
export default class ClientVersionMiddleware {
  constructor(protected minimums: () => ClientMinimums = configuredClientMinimums) {}

  async handle(ctx: HttpContext, next: NextFn) {
    const verdict = judgeClientVersion(ctx.request.header('x-client-version'), this.minimums())

    if (verdict.kind === 'invalid') {
      return ctx.response
        .status(422)
        .send({ code: 'validation_failed', fields: { 'X-Client-Version': 'invalid' } })
    }
    if (verdict.kind === 'upgrade_required') {
      return ctx.response
        .status(426)
        .send({ code: 'client_upgrade_required', minimumVersion: verdict.minimumVersion })
    }
    return next()
  }
}
