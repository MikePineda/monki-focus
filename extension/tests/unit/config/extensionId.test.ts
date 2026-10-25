// SPDX-License-Identifier: AGPL-3.0-or-later
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { extensionIdOf } from '../../../config/extensionId'

describe('extensionIdOf', () => {
  it('an_id_is_32_letters_from_a_to_p', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const der = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

    expect(extensionIdOf(der)).toMatch(/^[a-p]{32}$/)
  })

  it('the_id_is_the_sha256_of_the_key_mapped_to_letters', () => {
    // SHA-256(0x00) starts 6e340b9cffb37a989ca544e6bb780a2c: 6->g, e->o, 3->d, 4->e, ...
    expect(extensionIdOf(Buffer.from([0]).toString('base64'))).toBe(
      'godealjmppldhkjijmkfeeogllhiakcm'
    )
  })

  it('an_empty_key_is_refused', () => {
    expect(() => extensionIdOf('  ')).toThrow(RangeError)
  })
})
