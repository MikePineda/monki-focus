// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import { passwordProblems } from '#domain/accounts/password_policy'

test.group('Password policy', () => {
  test('test_a_long_varied_passphrase_is_accepted', ({ assert }) => {
    assert.deepEqual(passwordProblems('orbit lantern cactus 42'), [])
  })

  test('test_fewer_than_twelve_characters_is_too_short', ({ assert }) => {
    assert.include(passwordProblems('short-pw9!'), 'too_short')
  })

  test('test_length_counts_code_points_not_utf16_units', ({ assert }) => {
    // 11 emoji are 22 UTF-16 units but still 11 characters.
    assert.include(passwordProblems('🐒🦊🐼🐨🐯🦁🐮🐷🐸🐵🐔'), 'too_short')
  })

  test('test_more_than_128_characters_is_too_long', ({ assert }) => {
    assert.include(passwordProblems(`${'abcdefghij'.repeat(13)}`), 'too_long')
  })

  test('test_a_guessable_word_wrapped_in_digits_and_symbols_is_too_common', ({ assert }) => {
    assert.include(passwordProblems('Password-2026!'), 'too_common')
    assert.include(passwordProblems('###admin123456'), 'too_common')
  })

  test('test_digits_only_is_too_common', ({ assert }) => {
    assert.include(passwordProblems('839201746582'), 'too_common')
  })

  test('test_few_distinct_characters_is_too_repetitive', ({ assert }) => {
    assert.include(passwordProblems('abababababab'), 'too_repetitive')
  })

  test('test_the_email_local_part_inside_the_password_is_refused', ({ assert }) => {
    assert.include(
      passwordProblems('the-user-wins-1984', { email: 'the-user@example.com' }),
      'contains_email'
    )
    assert.notInclude(
      passwordProblems('orbit lantern cactus 42', { email: 'the-user@example.com' }),
      'contains_email'
    )
  })
})
