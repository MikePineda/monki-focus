// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RejectionCode, Ruleset, ValidationResult } from '@monki-focus/rules/pure'
import { validateRuleset as generatedValidateRuleset } from 'virtual:monki-ruleset-validator'

/**
 * SEMANTICS.md §1: no rules document may exceed 256 KiB of UTF-8. Kept here
 * (not imported from the rules package's validator module) so nothing pulls
 * Ajv's run-time compiler into the bundle.
 */
export const MAX_RULESET_BYTES = 256 * 1024

/** UTF-8 size of `value` serialised as JSON. */
export function serialisedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function codeOf(keywords: readonly string[]): RejectionCode {
  if (keywords.includes('x-uniqueBy')) return 'duplicate_key'
  if (keywords.includes('x-registrableDomain')) return 'invalid_domain'
  if (keywords.includes('x-timeZone')) return 'invalid_time_zone'
  return 'schema'
}

/**
 * The rule set validator of the extension: the rules package schemas
 * compiled at build time (MV3 forbids Ajv's run-time `new Function`), with
 * the same rejection codes as `bundledSchemaValidator().validate('ruleset', …)`.
 */
export function validateRuleset(value: unknown): ValidationResult {
  if (serialisedBytes(value) > MAX_RULESET_BYTES) {
    return { valid: false, code: 'too_large', errors: ['document_too_large'] }
  }
  if (generatedValidateRuleset(value)) return { valid: true }
  const failures = generatedValidateRuleset.errors ?? []
  return {
    valid: false,
    code: codeOf(failures.map((failure) => failure.keyword)),
    errors: failures.map(
      (failure) => `${failure.instancePath || '/'} ${failure.message ?? 'is invalid'}`
    ),
  }
}

export type RulesetDocumentResult =
  { valid: true; ruleset: Ruleset } | { valid: false; code: RejectionCode }

/** Raw text (an imported file): size limit, then JSON syntax, then the schema. */
export function validateRulesetDocument(text: string): RulesetDocumentResult {
  if (new TextEncoder().encode(text).length > MAX_RULESET_BYTES) {
    return { valid: false, code: 'too_large' }
  }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { valid: false, code: 'invalid_json' }
  }
  const result = validateRuleset(value)
  return result.valid
    ? { valid: true, ruleset: value as Ruleset }
    : { valid: false, code: result.code }
}
