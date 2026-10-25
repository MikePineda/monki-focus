// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import router from '@adonisjs/core/services/router'
import { contractValidator, openApi } from '#tests/support/device_api'

/**
 * packages/protocol/openapi.yaml is the source of truth of the device API.
 * Every implemented `/api/v1/keys` and `/api/v1/device/*` route is an
 * operation of the contract, and every operation is implemented, except
 * those a later package owns (listed here with their package, and refused
 * once they are implemented so the list cannot go stale).
 */
const NOT_YET_IMPLEMENTED = new Map([
  ['POST /device/unlock-requests', 'S6'],
  ['GET /device/unlock-requests/{uuid}', 'S6'],
  ['DELETE /device/unlock-requests/{uuid}', 'S6'],
])

const METHODS = ['get', 'post', 'put', 'patch', 'delete']

function contractOperations(): string[] {
  return Object.entries(openApi().paths).flatMap(([path, item]) =>
    METHODS.filter((method) => method in item).map((method) => `${method.toUpperCase()} ${path}`)
  )
}

/** `/api/v1/device/unlock-requests/:uuid` → `/device/unlock-requests/{uuid}`. */
function implementedOperations(): string[] {
  return Object.values(router.toJSON())
    .flat()
    .filter(
      (route) => route.pattern === '/api/v1/keys' || route.pattern.startsWith('/api/v1/device/')
    )
    .flatMap((route) => {
      const path = route.pattern.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')
      return route.methods
        .filter((method) => method !== 'HEAD')
        .map((method) => `${method} ${path}`)
    })
}

test.group('Device API contract', () => {
  test('test_implemented_device_routes_equal_the_openapi_operations', ({ assert }) => {
    const implemented = implementedOperations().sort()
    const expected = contractOperations()
      .filter((operation) => !NOT_YET_IMPLEMENTED.has(operation))
      .sort()

    assert.deepEqual(implemented, expected)
    for (const operation of NOT_YET_IMPLEMENTED.keys()) {
      assert.include(contractOperations(), operation, `${operation} is in the contract`)
      assert.notInclude(implemented, operation, `${operation} landed: drop it from the list`)
    }
  })

  test('test_device_api_errors_match_the_contract_error_schema', async ({ client, assert }) => {
    const validate = contractValidator('Error')
    const answers = [
      await client.post('/api/v1/device/heartbeat').header('X-Client-Version', 'android/0.1.0'),
      await client.get('/api/v1/device/no-such-route'),
      await client.post('/api/v1/device/enroll').header('X-Client-Version', 'android/0.1.0'),
    ]

    assert.deepEqual(
      answers.map((answer) => answer.status()),
      [401, 404, 422]
    )
    for (const answer of answers) {
      assert.isTrue(validate(answer.body()), JSON.stringify([answer.status(), answer.body()]))
      assert.notProperty(answer.body(), 'message')
    }
  })
})
