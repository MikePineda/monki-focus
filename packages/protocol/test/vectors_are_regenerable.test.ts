// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { driftedVectors, generateVectors } from '../scripts/gen-vectors.mjs'

describe('scripts/gen-vectors.mjs', () => {
  it('test_committed_vectors_equal_regenerated_vectors', () => {
    expect(driftedVectors()).toEqual([])
  })

  it('test_vector_generation_is_deterministic', () => {
    expect(generateVectors()).toEqual(generateVectors())
  })
})
