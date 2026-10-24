// SPDX-License-Identifier: AGPL-3.0-or-later
import { bundledSchemaValidator, loadFixtures, starterPreset } from '@monki-focus/rules'
import { describe, expect, it } from 'vitest'
import { rulesetValidatorSource } from '../../../config/rulesetValidatorPlugin'
import { validateRuleset, validateRulesetDocument } from '../../../src/shared/RulesetValidation'

const invalidRulesets = loadFixtures('invalid').filter((fixture) => fixture.schema === 'ruleset')

describe('build-time ruleset validator', () => {
  it.each(invalidRulesets.map((fixture) => [fixture.id, fixture] as const))(
    'rejects_%s_with_the_shared_code',
    (_id, fixture) => {
      const result = validateRuleset(fixture.document)

      expect(result).toMatchObject({ valid: false, code: fixture.then.code })
      expect(result).toMatchObject(
        bundledSchemaValidator().validate('ruleset', fixture.document) as object
      )
    }
  )

  it('accepts_the_starter_preset', () => {
    expect(validateRuleset(starterPreset)).toEqual({ valid: true })
  })

  it('generated_source_never_calls_require_or_eval', () => {
    const source = rulesetValidatorSource()

    expect(source).not.toMatch(/\brequire\(/)
    expect(source).not.toMatch(/new Function|\beval\(/)
  })

  it('a_document_reports_json_and_size_problems_first', () => {
    expect(validateRulesetDocument('{ not json')).toEqual({ valid: false, code: 'invalid_json' })
    expect(validateRulesetDocument(' '.repeat(256 * 1024 + 1))).toEqual({
      valid: false,
      code: 'too_large',
    })
    expect(validateRulesetDocument(JSON.stringify(starterPreset))).toMatchObject({ valid: true })
  })
})
