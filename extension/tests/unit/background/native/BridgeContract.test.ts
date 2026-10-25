// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_TO_EXTENSION_TYPES,
  EXTENSION_TO_APP_TYPES,
  type BridgeDirection,
} from '../../../../src/background/native/BridgeContract'
import {
  serialisedBytes,
  validateFromApp,
  validateToApp,
} from '../../../../src/background/native/BridgeMessageValidator'

/**
 * The native messaging contract over the shared fixtures of
 * `@monki-focus/protocol` (MonkiCore runs the same files). `text` fixtures
 * are about strict JSON text, which the extension never parses itself (the
 * browser hands it values), so they are MonkiCore's.
 */

interface Fixture {
  name: string
  direction: BridgeDirection
  reason?: string
  message?: unknown
  text?: string
  padTo?: { pointer: string; bytes: number }
}

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('@monki-focus/protocol/fixtures/bridge/README.md'))

function load(folder: string): Fixture[] {
  return readdirSync(join(root, folder))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(root, folder, file), 'utf8')) as Fixture)
}

function withPadding(fixture: Fixture): unknown {
  const message = structuredClone(fixture.message) as Record<string, unknown>
  if (fixture.padTo === undefined) return message
  const segments = fixture.padTo.pointer.split('/').slice(1)
  const last = segments.pop() ?? ''
  let parent = message
  for (const segment of segments) parent = parent[segment] as Record<string, unknown>
  parent[last] = ''
  parent[last] = 'x'.repeat(fixture.padTo.bytes - serialisedBytes(message))
  return message
}

const validate = (direction: BridgeDirection, value: unknown) =>
  direction === 'app-to-extension' ? validateFromApp(value) : validateToApp(value)

const valid = load('valid')
const invalid = load('invalid')
const messageFixtures = invalid.filter((fixture) => fixture.text === undefined)

describe('native messaging contract fixtures', () => {
  it.each(valid.map((fixture) => [fixture.name, fixture] as const))(
    '%s is accepted',
    (_name, fixture) => {
      expect(validate(fixture.direction, fixture.message)).toEqual({
        ok: true,
        message: fixture.message,
      })
    }
  )

  it.each(messageFixtures.map((fixture) => [fixture.name, fixture] as const))(
    '%s',
    (_name, fixture) => {
      expect(validate(fixture.direction, withPadding(fixture))).toEqual({
        ok: false,
        reason: fixture.reason,
      })
    }
  )

  it('every message type has a valid fixture and every code an invalid one', () => {
    const types = new Set(valid.map((fixture) => (fixture.message as { type: string }).type))
    expect([...types].sort()).toEqual([...EXTENSION_TO_APP_TYPES, ...APP_TO_EXTENSION_TYPES].sort())
    expect(new Set(messageFixtures.map((fixture) => fixture.reason)).size).toBe(7)
  })

  it('only text fixtures are left to MonkiCore', () => {
    expect(invalid.filter((fixture) => fixture.text !== undefined).map((f) => f.reason)).toEqual([
      'invalid_json',
      'invalid_json',
    ])
  })

  it('the extension can send nothing that changes rules or unlocks', () => {
    expect(EXTENSION_TO_APP_TYPES).toEqual([
      'hello',
      'browser.focus',
      'browser.activity',
      'bypass.event',
    ])
  })
})
