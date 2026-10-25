// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'

/** Routes that carry no session: Bearer device tokens and ntfy capability URLs. */
const SESSIONLESS_PREFIXES = ['/api/v1/device/', '/api/v1/actions/']

/** Named middleware that read or require the dashboard session. */
const SESSION_MIDDLEWARE = new Set(['silentAuth', 'sessionVersion', 'guest'])

type NamedMiddleware = { name?: string; args?: unknown }

/** The guards an `auth` middleware is configured with (none given = the default, the session). */
function guardsOf(entry: NamedMiddleware): string[] {
  const args = Array.isArray(entry.args) ? entry.args[0] : entry.args
  const guards = (args as { guards?: unknown } | undefined)?.guards
  return Array.isArray(guards) ? guards.map(String) : ['<default>']
}

test.group('Route guards', () => {
  /*
   * Placeholder for the device API (S3-S7): passes vacuously while no such
   * route exists, and fails the moment one is added behind the session or
   * cookie guard. Those routes authenticate with the `device` guard only;
   * CSRF exemptions (app/http/csrf_exempt_routes.ts) rely on it.
   */
  test('test_device_and_action_routes_never_use_the_session_guard', ({ assert }) => {
    const violations: string[] = []
    for (const routes of Object.values(router.toJSON())) {
      for (const route of routes) {
        if (!SESSIONLESS_PREFIXES.some((prefix) => route.pattern.startsWith(prefix))) continue
        for (const entry of route.middleware.all() as Set<NamedMiddleware>) {
          const name = typeof entry === 'object' ? entry.name : undefined
          if (name && SESSION_MIDDLEWARE.has(name)) violations.push(`${route.pattern}: ${name}`)
          if (name === 'auth' && guardsOf(entry).some((guard) => guard !== 'device')) {
            violations.push(`${route.pattern}: auth(${guardsOf(entry).join(', ')})`)
          }
        }
      }
    }

    assert.deepEqual(violations, [])
  })
})
