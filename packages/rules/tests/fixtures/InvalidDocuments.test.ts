// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  MAX_DOCUMENT_BYTES,
  loadFixtures,
  loadStarterPreset,
  schemaValidator,
} from '../../src/index.ts'

describe('invalid documents', () => {
  it.each(loadFixtures('invalid').map((fixture) => [fixture.id, fixture] as const))(
    'invalid_document_is_rejected_with_its_code %s',
    (_id, fixture) => {
      const result = schemaValidator().validate(fixture.schema, fixture.document)
      expect(result.valid).toBe(false)
      expect(result.valid ? null : result.code).toBe(fixture.then.code)
    }
  )

  it('oversized_document_is_rejected_with_code_too_large', () => {
    const text = JSON.stringify(loadStarterPreset()) + ' '.repeat(MAX_DOCUMENT_BYTES)
    const result = schemaValidator().validateDocument('ruleset', text)
    expect(result.valid ? null : result.code).toBe('too_large')
  })

  it('malformed_json_is_rejected_with_code_invalid_json', () => {
    const result = schemaValidator().validateDocument('ruleset', '{"rules": [')
    expect(result.valid ? null : result.code).toBe('invalid_json')
  })

  it('valid_rule_set_passes', () => {
    expect(schemaValidator().validate('ruleset', loadStarterPreset())).toEqual({ valid: true })
  })
})
