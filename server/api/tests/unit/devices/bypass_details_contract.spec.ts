// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { parse } from 'yaml'
import { CLIENT_BYPASS_KINDS } from '#domain/devices/bypass_event_kinds'
import {
  BYPASS_DETAIL_RULES,
  checkBypassDetails,
  type DetailRule,
} from '#domain/devices/bypass_event_details'

/**
 * The per-kind details allowlist exists twice: in the server's domain and
 * in openapi.yaml (`BypassEvent`), which clients build against. For every
 * client kind and every known detail key, with an in-range value, an
 * out-of-range one and a free string, both must agree.
 */
function bypassEventValidator() {
  const spec = parse(
    readFileSync(fileURLToPath(import.meta.resolve('@monki-focus/protocol/openapi.yaml')), 'utf8')
  ) as { components: { schemas: Record<string, unknown> } }
  const ajv = new Ajv2020({ strict: false, allErrors: true })
  ajv.addFormat('date-time', true)
  ajv.addSchema({ $id: 'urn:monki-focus:openapi', components: spec.components })
  return ajv.compile({ $ref: 'urn:monki-focus:openapi#/components/schemas/BypassEvent' })
}

function samples(rule: DetailRule): unknown[] {
  if (rule.type === 'enum') return [rule.values[0], `${rule.values[0]}.example.com`, 1]
  return [rule.min, rule.max, rule.max + 1, rule.min - 1, rule.min + 0.5, String(rule.min)]
}

test.group('Bypass details contract', () => {
  test('test_openapi_and_the_server_agree_on_every_kinds_details', ({ assert }) => {
    const validate = bypassEventValidator()
    const allRules = new Map<string, DetailRule>()
    for (const rules of Object.values(BYPASS_DETAIL_RULES)) {
      for (const [key, rule] of Object.entries(rules)) allRules.set(key, rule)
    }
    allRules.set('site', { type: 'enum', values: ['reddit.com'] })

    let checked = 0
    for (const kind of CLIENT_BYPASS_KINDS) {
      for (const [key, rule] of allRules) {
        for (const value of samples(rule)) {
          const details = { [key]: value }
          const event = { dedupeKey: 'k', kind, occurredAt: '2026-01-05T09:00:00Z', details }
          assert.equal(
            validate(event),
            checkBypassDetails(kind, details).ok,
            `${kind} ${JSON.stringify(details)}`
          )
          checked++
        }
      }
    }
    assert.isAbove(checked, 100)
  })
})
