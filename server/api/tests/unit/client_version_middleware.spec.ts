// SPDX-License-Identifier: AGPL-3.0-or-later
import { Socket } from 'node:net'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { IncomingMessage, ServerResponse } from 'node:http'
import ClientVersionMiddleware from '#middleware/client_version_middleware'

async function contextWith(headers: Record<string, string>) {
  const req = new IncomingMessage(new Socket())
  req.headers = headers
  const res = new ServerResponse(req)
  return testUtils.createHttpContext({ req, res })
}

const middleware = new ClientVersionMiddleware(() => ({ android: '0.3.0' }))

test.group('Client version middleware', () => {
  test('test_old_client_gets_426_with_the_minimum_version', async ({ assert }) => {
    const ctx = await contextWith({ 'x-client-version': 'android/0.2.0' })
    let reached = false

    await middleware.handle(ctx, async () => {
      reached = true
    })

    assert.isFalse(reached)
    assert.equal(ctx.response.getStatus(), 426)
    assert.deepEqual(ctx.response.getBody(), {
      code: 'client_upgrade_required',
      minimumVersion: '0.3.0',
    })
  })

  test('test_missing_header_is_a_validation_failure_with_a_reason_code', async ({ assert }) => {
    const ctx = await contextWith({})

    await middleware.handle(ctx, async () => {})

    assert.equal(ctx.response.getStatus(), 422)
    assert.deepEqual(ctx.response.getBody(), {
      code: 'validation_failed',
      fields: { 'X-Client-Version': 'invalid' },
    })
  })

  test('test_current_client_reaches_the_route', async ({ assert }) => {
    const ctx = await contextWith({ 'x-client-version': 'android/0.3.1' })
    let reached = false

    await middleware.handle(ctx, async () => {
      reached = true
    })

    assert.isTrue(reached)
  })
})
