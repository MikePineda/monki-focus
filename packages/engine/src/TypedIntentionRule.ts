// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The typed-intention rule (SEMANTICS.md §7.5). When a gate requires a typed
 * intention (from L2, never on the short extension gate) the text MUST have
 * at least 3 words and MUST differ from the previous intention text of the
 * group, compared after trimming, collapsing whitespace and lower-casing. A
 * word is a word-like segment of Unicode default word boundaries (UAX #29,
 * `Intl.Segmenter`), so punctuation and repeated spaces never count; without
 * a segmenter, a whitespace-separated token with a letter or digit is a word.
 * Only the word count reaches `nextEscalation` (`commit.typedWords`); the
 * text itself never leaves the device.
 */
import type { Gate } from '@monki-focus/rules'

export const MIN_INTENTION_WORDS = 3

export interface IntentionRequirements {
  minWords: number
  mustDifferFromPrevious: boolean
}

/** Fixed locale: word boundaries must not depend on the device language. */
const SEGMENTER_LOCALE = 'en'

const WHITESPACE = /\s+/u
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

export function intentionRequirements(gate: Gate): IntentionRequirements {
  return gate.requiresTypedIntention
    ? { minWords: MIN_INTENTION_WORDS, mustDifferFromPrevious: true }
    : { minWords: 0, mustDifferFromPrevious: false }
}

/** Words in `text`: UAX #29 word-like segments, or the whitespace fallback. */
export function intentionWordCount(text: string): number {
  if (typeof Intl.Segmenter === 'function') {
    let count = 0
    const segmenter = new Intl.Segmenter(SEGMENTER_LOCALE, { granularity: 'word' })
    for (const segment of segmenter.segment(text)) if (segment.isWordLike === true) count += 1
    return count
  }
  return whitespaceWordCount(text)
}

/** The fallback for platforms without a word segmenter. */
export function whitespaceWordCount(text: string): number {
  return text.split(WHITESPACE).filter((token) => LETTER_OR_DIGIT.test(token)).length
}

function comparable(text: string): string {
  return text.trim().split(WHITESPACE).join(' ').toLowerCase()
}

export function isIntentionAcceptable(text: string, previous: string | null, gate: Gate): boolean {
  const { minWords, mustDifferFromPrevious } = intentionRequirements(gate)
  if (intentionWordCount(text) < minWords) return false
  if (!mustDifferFromPrevious || previous === null || comparable(previous) === '') return true
  return comparable(text) !== comparable(previous)
}
