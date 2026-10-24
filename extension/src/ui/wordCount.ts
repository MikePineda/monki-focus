// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locale } from '../i18n/locale'

/**
 * Words in `text` by the locale's word boundaries (`Intl.Segmenter`), so
 * punctuation and repeated spaces never count. Display only: the intention
 * rule itself (≥ 3 words, different from last time) belongs to the engine.
 */
export function wordCount(text: string, locale: Locale): number {
  let count = 0
  for (const segment of new Intl.Segmenter(locale, { granularity: 'word' }).segment(text)) {
    if (segment.isWordLike) count += 1
  }
  return count
}
