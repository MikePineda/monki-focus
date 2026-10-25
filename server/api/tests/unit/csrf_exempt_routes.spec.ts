// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { isCsrfExempt } from '#http/csrf_exempt_routes'

test.group('CSRF exemptions', () => {
  test('test_bearer_device_routes_and_action_urls_skip_csrf', ({ assert }) => {
    assert.isTrue(isCsrfExempt('/api/v1/device/heartbeat'))
    assert.isTrue(isCsrfExempt('/api/v1/device/unlock-requests/6f1c2d3e?wait=25'))
    assert.isTrue(isCsrfExempt('/api/v1/actions/opaque-capability'))
  })

  test('test_dashboard_routes_keep_csrf', ({ assert }) => {
    for (const url of [
      '/api/v1/devices',
      '/api/v1/devices/enrollment-codes',
      '/api/v1/device',
      '/api/v1/actionsx/forged',
      '/api/v1/auth/login',
      '/api/test/tick',
      '/api/v2/device/heartbeat',
      '/x/api/v1/device/heartbeat',
    ]) {
      assert.isFalse(isCsrfExempt(url), url)
    }
  })
})
