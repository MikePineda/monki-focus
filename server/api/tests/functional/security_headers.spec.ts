// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'

test.group('Shield', () => {
  test('test_responses_carry_a_strict_csp_and_are_never_framed', async ({ client, assert }) => {
    const response = await client.get('/api/health/live')

    const csp = String(response.header('content-security-policy'))
    assert.include(csp, `default-src 'self'`)
    assert.include(csp, `frame-ancestors 'none'`)
    assert.include(csp, `object-src 'none'`)
    assert.match(csp, /script-src 'self' 'nonce-[^']+'/)
    response.assertHeader('x-frame-options', 'DENY')
    response.assertHeader('x-content-type-options', 'nosniff')
  })

  test('test_dashboard_post_without_csrf_is_rejected', async ({ client }) => {
    const response = await client.post('/api/test/tick').header('accept-language', 'en')

    response.assertStatus(403)
    response.assertBodyContains({ code: 'E_BAD_CSRF_TOKEN' })
  })

  test('test_dashboard_post_with_csrf_token_is_accepted', async ({ client }) => {
    const response = await client.post('/api/test/tick').withCsrfToken()

    response.assertStatus(200)
    response.assertBody({ jobs: ['deadman', 'device_retention'] })
  })

  test('test_a_dashboard_get_hands_out_the_xsrf_cookie', async ({ client, assert }) => {
    const response = await client.get('/api/v1/auth/me')

    assert.exists(response.cookie('XSRF-TOKEN'))
  })

  test('test_probes_and_public_routes_hand_out_no_cookie', async ({ client, assert }) => {
    for (const path of ['/api/health', '/api/health/live', '/api/v1/no-such-route']) {
      const response = await client.get(path)
      assert.isUndefined(response.header('set-cookie'), path)
    }
  })
})
