// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { randomLetters } from '../../../src/shared/RandomLetters'

function scripted(...batches: number[][]): (size: number) => Uint8Array {
  return (size) => {
    const next = batches.shift() ?? []
    return Uint8Array.from(next.slice(0, size))
  }
}

describe('randomLetters', () => {
  it('rejects_bytes_that_would_bias_the_modulo_and_redraws_them', () => {
    // 234 and 255 fold onto 'a'/'v' with bias, so they are discarded.
    expect(randomLetters(3, scripted([234, 0, 255], [25, 1]))).toBe('azb')
  })

  it('maps_each_accepted_byte_onto_the_alphabet', () => {
    expect(randomLetters(4, scripted([0, 25, 26, 233]))).toBe('azaz')
  })

  it('returns_only_lowercase_letters_of_the_requested_length', () => {
    expect(randomLetters(12)).toMatch(/^[a-z]{12}$/)
  })
})
