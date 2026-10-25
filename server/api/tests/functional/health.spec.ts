// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'

test.group('Health probes', () => {
  test('test_readiness_reports_ok_with_version_sha_and_the_database_check', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/health')

    response.assertStatus(200)
    response.assertBodyContains({ status: 'ok' })
    const body = response.body()
    assert.isString(body.version)
    assert.isNotEmpty(body.version)
    assert.isString(body.sha)
    assert.isNotEmpty(body.sha)
    assert.properties(body.checks, ['database', 'memory_heap'])
    assert.equal(body.checks.database.status, 'ok')
  })

  test('test_readiness_never_leaks_process_details', async ({ client, assert }) => {
    const response = await client.get('/api/health')

    assert.notProperty(response.body(), 'debugInfo')
    assert.deepEqual(response.body().checks.database, { status: 'ok' })
  })

  test('test_liveness_answers_without_touching_dependencies', async ({ client }) => {
    const response = await client.get('/api/health/live')

    response.assertStatus(200)
    response.assertBody({ status: 'ok' })
  })
})
