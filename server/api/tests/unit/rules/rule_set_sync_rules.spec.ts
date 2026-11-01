// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { createHash } from 'node:crypto'
import {
  NO_RULE_SET_REVISION,
  isNotModified,
  parseRevisionTag,
  revisionTag,
} from '#domain/rules/rule_set_etag'
import { checkIfMatch } from '#domain/rules/rule_set_precondition'
import { canonicalJson, ruleSetContentHash } from '#domain/rules/rule_set_content_hash'
import { MAX_RULE_SET_PROBLEMS, ruleSetProblems } from '#domain/rules/rule_set_problems'
import { MAX_RULE_SET_DEPTH, findUnstorableValue } from '#domain/rules/rule_set_storable_value'
import { ruleSetOfRawBody } from '#domain/rules/rule_set_raw_body'

function nested(depth: number): unknown {
  let value: unknown = 'leaf'
  for (let level = 0; level < depth; level++) value = [value]
  return value
}

test.group('Rule set ETag', () => {
  test('test_the_etag_is_the_quoted_revision', ({ assert }) => {
    assert.equal(revisionTag(0), '"0"')
    assert.equal(revisionTag(42), '"42"')
    assert.equal(NO_RULE_SET_REVISION, 0)
  })

  test('test_only_a_strong_quoted_decimal_parses_as_a_revision', ({ assert }) => {
    assert.equal(parseRevisionTag('"7"'), 7)
    assert.equal(parseRevisionTag(' "0" '), 0)
    for (const header of [
      undefined,
      null,
      '',
      '7',
      'W/"7"',
      '"07"',
      '"-1"',
      '"1.5"',
      '"7", "8"',
      '*',
      '"99999999999"',
    ]) {
      assert.isNull(parseRevisionTag(header), String(header))
    }
  })

  test('test_if_none_match_hits_the_current_revision_weak_or_strong_or_in_a_list', ({ assert }) => {
    assert.isTrue(isNotModified('"3"', 3))
    assert.isTrue(isNotModified('W/"3"', 3))
    assert.isTrue(isNotModified('"1", "3"', 3))
    assert.isTrue(isNotModified('*', 3))
    assert.isFalse(isNotModified('"2"', 3))
    assert.isFalse(isNotModified(undefined, 3))
    assert.isFalse(isNotModified('garbage', 3))
  })
})

test.group('Rule set If-Match precondition', () => {
  test('test_a_matching_if_match_moves_to_the_next_revision', ({ assert }) => {
    assert.deepEqual(checkIfMatch('"0"', 0), { ok: true, next: 1 })
    assert.deepEqual(checkIfMatch('"41"', 41), { ok: true, next: 42 })
  })

  test('test_a_missing_or_malformed_if_match_is_required', ({ assert }) => {
    for (const header of [undefined, '', '*', 'W/"4"', '4']) {
      assert.deepEqual(checkIfMatch(header, 4), { ok: false, reason: 'if_match_required' })
    }
  })

  test('test_a_stale_if_match_is_a_revision_mismatch', ({ assert }) => {
    assert.deepEqual(checkIfMatch('"3"', 4), { ok: false, reason: 'revision_mismatch' })
    assert.deepEqual(checkIfMatch('"5"', 4), { ok: false, reason: 'revision_mismatch' })
  })

  test('test_the_revision_never_overflows_the_column', ({ assert }) => {
    assert.deepEqual(checkIfMatch('"2147483647"', 2147483647), {
      ok: false,
      reason: 'revision_exhausted',
    })
  })
})

test.group('Rule set content hash', () => {
  test('test_canonical_json_sorts_keys_at_every_depth_without_whitespace', ({ assert }) => {
    assert.equal(
      canonicalJson({ b: 1, a: [{ d: 'x', c: null }, true], é: 'ü' }),
      '{"a":[{"c":null,"d":"x"},true],"b":1,"é":"ü"}'
    )
  })

  test('test_the_content_hash_ignores_key_order_and_is_base64url_sha256', ({ assert }) => {
    const first = ruleSetContentHash({ rules: [], timeZone: 'UTC' })
    const second = ruleSetContentHash({ timeZone: 'UTC', rules: [] })
    assert.equal(first, second)
    assert.match(first, /^[A-Za-z0-9_-]{43}$/)
    assert.equal(
      first,
      createHash('sha256').update('{"rules":[],"timeZone":"UTC"}', 'utf8').digest('base64url')
    )
    assert.notEqual(first, ruleSetContentHash({ timeZone: 'UTC', rules: [1] }))
  })
})

test.group('Rule set problems', () => {
  test('test_problems_are_dotted_paths_and_rejection_codes_never_values', ({ assert }) => {
    const problems = ruleSetProblems({
      valid: false,
      code: 'schema',
      errors: [
        '/rules/0/target/domain must match pattern "^[a-z]+$"',
        '/timeZone must be string',
        "/ must have required property 'rules'",
      ],
    })
    assert.deepEqual(problems, {
      'ruleSet.rules.0.target.domain': 'schema',
      'ruleSet.timeZone': 'schema',
      'ruleSet': 'schema',
    })
    assert.notInclude(JSON.stringify(problems), 'pattern')
  })

  test('test_a_whole_document_failure_is_reported_on_the_rule_set', ({ assert }) => {
    assert.deepEqual(
      ruleSetProblems({ valid: false, code: 'too_large', errors: ['document_too_large'] }),
      { ruleSet: 'too_large' }
    )
  })

  test('test_a_path_segment_outside_the_schema_alphabet_is_masked', ({ assert }) => {
    assert.deepEqual(
      ruleSetProblems({ valid: false, code: 'schema', errors: ['/rules/0/a.b@c is invalid'] }),
      { 'ruleSet.rules.0.*': 'schema' }
    )
  })

  test('test_problems_are_capped', ({ assert }) => {
    const errors = Array.from({ length: 100 }, (_, index) => `/rules/${index} must be object`)
    const problems = ruleSetProblems({ valid: false, code: 'schema', errors })
    assert.lengthOf(Object.keys(problems), MAX_RULE_SET_PROBLEMS)
  })

  test('test_a_valid_result_has_no_problems', ({ assert }) => {
    assert.deepEqual(ruleSetProblems({ valid: true }), {})
  })
})

test.group('Rule set storable values', () => {
  test('test_a_nul_character_anywhere_is_unstorable_at_its_pointer', ({ assert }) => {
    assert.deepEqual(findUnstorableValue({ rules: [{ note: 'a\u0000b' }] }), {
      pointer: '/rules/0/note',
    })
    assert.deepEqual(findUnstorableValue({ ['k\u0000']: 1 }), { pointer: '/k\u0000' })
  })

  test('test_a_lone_surrogate_is_unstorable', ({ assert }) => {
    assert.deepEqual(findUnstorableValue({ rules: [{ note: 'x\ud800' }] }), {
      pointer: '/rules/0/note',
    })
    assert.deepEqual(findUnstorableValue({ ['\udc00']: true }), { pointer: '/\udc00' })
  })

  test('test_nesting_beyond_the_limit_is_unstorable', ({ assert }) => {
    assert.isNull(findUnstorableValue(nested(MAX_RULE_SET_DEPTH)))
    assert.isNotNull(findUnstorableValue(nested(MAX_RULE_SET_DEPTH + 1)))
    assert.isNotNull(findUnstorableValue(nested(100_000)))
  })

  test('test_ordinary_text_empty_strings_and_emoji_are_storable', ({ assert }) => {
    assert.isNull(findUnstorableValue({ note: '', other: 'focus \u{1F412} n', n: [1, null, true] }))
  })

  test('test_canonical_json_refuses_nesting_beyond_the_limit_with_a_typed_error', ({ assert }) => {
    assert.doesNotThrow(() => canonicalJson(nested(MAX_RULE_SET_DEPTH)))
    assert.throws(() => canonicalJson(nested(100_000)), /rule_set_too_deep/)
  })
})

test.group('Rule set raw body', () => {
  test('test_the_rule_set_comes_from_the_raw_json_with_empty_strings_kept', ({ assert }) => {
    assert.deepEqual(ruleSetOfRawBody('{"ruleSet":{"note":""}}'), { note: '' })
  })

  test('test_a_body_without_a_rule_set_object_member_gives_undefined', ({ assert }) => {
    for (const raw of [null, undefined, '', 'not json', '[]', '{"ruleSet":1}', '{}']) {
      assert.isUndefined(ruleSetOfRawBody(raw), String(raw))
    }
  })
})
