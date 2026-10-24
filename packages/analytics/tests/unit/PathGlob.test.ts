// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { literalSegmentCount, matchesGlob, wildcardCount } from '../../src/PathGlob.ts'

describe('PathGlob', () => {
  it('root_glob_matches_only_the_root', () => {
    expect(matchesGlob('/', '/')).toBe(true)
    expect(matchesGlob('/', '/a')).toBe(false)
  })

  it('double_star_matches_zero_or_more_segments', () => {
    expect(matchesGlob('/reels/**', '/reels')).toBe(true)
    expect(matchesGlob('/reels/**', '/reels/a/b')).toBe(true)
    expect(matchesGlob('/reels/**', '/')).toBe(false)
  })

  it('star_matches_exactly_one_segment', () => {
    expect(matchesGlob('/r/*', '/r/x')).toBe(true)
    expect(matchesGlob('/r/*', '/r/x/comments')).toBe(false)
    expect(matchesGlob('/r/*', '/r')).toBe(false)
  })

  it('literals_compare_ascii_case_insensitively_only', () => {
    expect(matchesGlob('/shorts/**', '/SHORTS/a')).toBe(true)
    // U+212A KELVIN SIGN lower-cases to `k` in Unicode, never in ASCII.
    expect(matchesGlob('/k', '/K')).toBe(false)
  })

  it('wildcard_only_globs_have_no_literal_segments', () => {
    expect(literalSegmentCount('/*/**')).toBe(0)
    expect(wildcardCount('/*/**')).toBe(2)
    expect(literalSegmentCount('/r/*/comments/**')).toBe(2)
  })
})
