// SPDX-License-Identifier: AGPL-3.0-or-later
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { dbAssertions } from '@adonisjs/lucid/plugins/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { shieldApiClient } from '@adonisjs/shield/plugins/api_client'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'

/**
 * Imported by bin/test.ts. Plugins: `client.get(...)` (api client), session
 * and `withCsrfToken()` (shield), `db.assertHas(...)` (Lucid). `loginAs`
 * (auth) joins with the users package (S2).
 */
export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  dbAssertions(app),
  apiClient(),
  sessionApiClient(app),
  shieldApiClient(),
]

/** Runner-wide hooks. Empty, so the unit suite never needs a database. */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
}

/**
 * The Laravel `RefreshDatabase` equivalent for suites that talk to Postgres:
 * migrate the test database once per run (rolled back at the end) and wrap
 * every test of every group in a global transaction rolled back after it.
 * The functional suite also starts the HTTP server.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'functional') {
    suite.setup(() => testUtils.db().migrate())
    suite.onGroup((group) => {
      group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
    })
    return suite.setup(() => testUtils.httpServer().start())
  }
}
