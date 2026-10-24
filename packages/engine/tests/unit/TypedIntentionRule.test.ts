// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it } from 'vitest'
import type { Gate } from '@monki-focus/rules'
import {
  MIN_INTENTION_WORDS,
  intentionRequirements,
  intentionWordCount,
  isIntentionAcceptable,
} from '../../src/index.ts'
import { whitespaceWordCount } from '../../src/TypedIntentionRule.ts'

const gateAt = (level: Gate['level'], requiresTypedIntention = level >= 2): Gate => ({
  level,
  pauseSeconds: 15,
  frictionType: 'reflect',
  requiresTypedIntention,
  requiresGuardianKey: false,
})

describe('typed intention rule (SEMANTICS.md §7.5)', () => {
  const segmenter = Intl.Segmenter
  afterEach(() => {
    Reflect.set(Intl, 'Segmenter', segmenter)
  })

  it('from_level_two_three_words_and_a_new_text_are_required', () => {
    expect(MIN_INTENTION_WORDS).toBe(3)
    expect(intentionRequirements(gateAt(2))).toEqual({ minWords: 3, mustDifferFromPrevious: true })
    expect(intentionRequirements(gateAt(3))).toEqual({ minWords: 3, mustDifferFromPrevious: true })
  })

  it('below_level_two_and_on_the_extension_gate_nothing_is_typed', () => {
    const none = { minWords: 0, mustDifferFromPrevious: false }
    expect(intentionRequirements(gateAt(0))).toEqual(none)
    expect(intentionRequirements(gateAt(1))).toEqual(none)
    expect(intentionRequirements(gateAt(2, false))).toEqual(none)
    expect(isIntentionAcceptable('', 'reply to a message', gateAt(1))).toBe(true)
  })

  it('two_words_are_not_enough_and_three_are', () => {
    expect(isIntentionAcceptable('check messages', null, gateAt(2))).toBe(false)
    expect(isIntentionAcceptable('check my messages', null, gateAt(2))).toBe(true)
  })

  it('punctuation_and_repeated_spaces_are_not_words', () => {
    expect(intentionWordCount('  read ,  -  the   news !! ')).toBe(3)
    expect(isIntentionAcceptable('read — news …', null, gateAt(2))).toBe(false)
  })

  it('the_same_text_as_last_time_is_rejected_ignoring_case_and_spacing', () => {
    const previous = 'Reply to a message'
    expect(isIntentionAcceptable('  reply TO a   message ', previous, gateAt(3))).toBe(false)
    expect(isIntentionAcceptable('reply to the message', previous, gateAt(3))).toBe(true)
  })

  it('a_blank_previous_text_imposes_nothing', () => {
    expect(isIntentionAcceptable('reply to a message', '   ', gateAt(2))).toBe(true)
  })

  it('words_follow_unicode_word_boundaries', () => {
    expect(intentionWordCount('revisar el correo')).toBe(3)
    expect(intentionWordCount("don't scroll now")).toBe(3)
  })

  it('without_a_segmenter_whitespace_tokens_with_a_letter_or_digit_are_words', () => {
    expect(whitespaceWordCount('  read  -  the news 2 ')).toBe(4)
    Reflect.set(Intl, 'Segmenter', undefined)
    expect(intentionWordCount('read - the news')).toBe(3)
    expect(isIntentionAcceptable('read the news', null, gateAt(2))).toBe(true)
  })
})
