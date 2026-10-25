// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'

test.group('Localization', () => {
  test('test_errors_follow_accept_language', async ({ client }) => {
    const response = await client
      .get('/api/v1/does-not-exist')
      .header('accept-language', 'es-MX,es;q=0.9,en;q=0.8')

    response.assertStatus(404)
    response.assertBody({ message: 'No encontrado', code: 'E_ROUTE_NOT_FOUND' })
    response.assertHeader('content-language', 'es')
  })

  test('test_unsupported_language_falls_back_to_the_default_locale', async ({ client }) => {
    const response = await client.get('/api/v1/does-not-exist').header('accept-language', 'fr-FR')

    response.assertStatus(404)
    response.assertBody({ message: 'Not found', code: 'E_ROUTE_NOT_FOUND' })
    response.assertHeader('content-language', 'en')
  })
})
