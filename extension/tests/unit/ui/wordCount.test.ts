// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { wordCount } from '../../../src/ui/wordCount'

describe('wordCount', () => {
  it('empty_or_blank_text_has_no_words', () => {
    expect(wordCount('', 'en')).toBe(0)
    expect(wordCount('   \n ', 'en')).toBe(0)
  })

  it('word_count_ignores_extra_spaces_and_punctuation', () => {
    expect(wordCount('  Reply to   one message!  ', 'en')).toBe(4)
    expect(wordCount('— , .', 'en')).toBe(0)
  })

  it('accented_words_count_once', () => {
    expect(wordCount('Revisar el menú del día', 'es')).toBe(5)
  })
})
