// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { ENV_NAMES, envSchema } from '#start/env_schema'
import { Secret } from '@adonisjs/core/helpers'

/** `NAME=value` lines of a dotenv file, comments and blanks skipped. */
async function dotenvEntries(file: string): Promise<Map<string, string>> {
  const content = await readFile(app.makePath(file), 'utf8')
  const entries = new Map<string, string>()
  for (const line of content.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match) entries.set(match[1], match[2])
  }
  return entries
}

/** Local docker-compose throwaways that `.env.example` may carry. */
const LOCAL_DEV_SECRETS = new Set(['DB_PASSWORD'])

test.group('.env.example', () => {
  test('test_env_example_documents_exactly_the_validated_variables', async ({ assert }) => {
    const entries = await dotenvEntries('.env.example')
    const documented = [...entries.keys()].sort()

    assert.deepEqual(documented, [...ENV_NAMES].sort())
  })

  test('test_env_example_ships_no_secret_values', async ({ assert }) => {
    const entries = await dotenvEntries('.env.example')
    for (const name of ENV_NAMES) {
      if (LOCAL_DEV_SECRETS.has(name)) continue
      let isSecret = false
      try {
        isSecret = envSchema[name](name, 'probe') instanceof Secret
      } catch {
        // A validator that rejects the probe value is not a secret one.
      }
      if (isSecret) assert.equal(entries.get(name), '', `${name} must be empty`)
    }
  })

  test('test_env_example_names_no_real_domain', async ({ assert }) => {
    const content = await readFile(app.makePath('.env.example'), 'utf8')
    const hosts = [...content.matchAll(/https?:\/\/([^\s/:]+)/g)].map((match) => match[1])

    for (const host of hosts) {
      assert.match(host, /^(localhost|127\.0\.0\.1|[\w-]+\.example(\.\w+)?)$/, host)
    }
  })
})
