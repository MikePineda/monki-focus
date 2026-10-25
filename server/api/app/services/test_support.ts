// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import app from '@adonisjs/core/services/app'

/**
 * Test-support routes (`/api/test/*`) exist only under NODE_ENV=test or with
 * E2E_MODE, which start/env_schema.ts refuses on a public production URL.
 */
export function testSupportEnabled(): boolean {
  return app.inTest || env.get('E2E_MODE') === true
}
