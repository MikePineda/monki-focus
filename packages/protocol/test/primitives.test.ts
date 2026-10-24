// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { decodeBase64Url, encodeBase64Url } from '../src/base64url.ts'
import { constantTimeEqual } from '../src/constant_time_equal.ts'
import { le64, pae } from '../src/pae.ts'
import { parseTokenParts } from '../src/token_parts.ts'

const utf8 = new TextEncoder()
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')

describe('pae', () => {
  // Examples straight from the PASETO spec, "Pre-Authentication Encoding".
  it('test_pae_of_no_pieces_is_eight_zero_bytes', () => {
    expect(hex(pae([]))).toBe('0000000000000000')
  })

  it('test_pae_of_one_empty_piece_matches_spec', () => {
    expect(hex(pae([new Uint8Array(0)]))).toBe('01000000000000000000000000000000')
  })

  it('test_pae_of_test_matches_spec', () => {
    expect(hex(pae([utf8.encode('test')]))).toBe('0100000000000000040000000000000074657374')
  })

  it('test_pae_distinguishes_piece_boundaries', () => {
    expect(hex(pae([utf8.encode('ab'), utf8.encode('c')]))).not.toBe(
      hex(pae([utf8.encode('a'), utf8.encode('bc')]))
    )
  })

  it('test_le64_is_little_endian_with_top_bit_clear', () => {
    expect(hex(le64(0x0102))).toBe('0201000000000000')
    expect(hex(le64(Number.MAX_SAFE_INTEGER))).toBe('ffffffffffff1f00')
    expect(() => le64(-1)).toThrow(RangeError)
  })
})

describe('base64url', () => {
  it('test_base64url_round_trips_without_padding', () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0x00, 0x01])
    expect(encodeBase64Url(bytes)).toBe('-_8AAQ')
    expect(decodeBase64Url('-_8AAQ')).toEqual(bytes)
  })

  it.each([
    ['padding', '-_8AAQ=='],
    ['standard alphabet plus', '+_8AAQ'],
    ['standard alphabet slash', '/_8AAQ'],
    ['whitespace', '-_8A AQ'],
    ['length 4n+1', '-_8AA'],
    ['non-canonical trailing bits', '-_8AAR'],
  ])('test_base64url_rejects_%s', (_label, text) => {
    expect(decodeBase64Url(text)).toBeNull()
  })
})

describe('constantTimeEqual', () => {
  it('test_constant_time_equal_compares_bytes', () => {
    expect(constantTimeEqual(utf8.encode('kid'), utf8.encode('kid'))).toBe(true)
    expect(constantTimeEqual(utf8.encode('kid'), utf8.encode('kie'))).toBe(false)
    expect(constantTimeEqual(utf8.encode('kid'), utf8.encode('kids'))).toBe(false)
  })
})

describe('parseTokenParts', () => {
  const body = encodeBase64Url(new Uint8Array(64))

  it('test_header_must_be_exactly_v4_public', () => {
    for (const header of [
      'v4.local.',
      'v3.public.',
      'V4.public.',
      'v4.public',
      'v4.publicc.',
      '',
    ]) {
      expect(parseTokenParts(`${header}${body}`)).toEqual({
        ok: false,
        error: { code: 'wrong_header' },
      })
    }
  })

  it('test_non_string_or_oversized_tokens_are_malformed', () => {
    expect(parseTokenParts(42)).toEqual({ ok: false, error: { code: 'malformed_token' } })
    expect(parseTokenParts(`v4.public.${'A'.repeat(5000)}`)).toEqual({
      ok: false,
      error: { code: 'malformed_token' },
    })
  })

  it('test_extra_parts_or_empty_footer_are_malformed', () => {
    expect(parseTokenParts(`v4.public.${body}.e30.e30`).ok).toBe(false)
    expect(parseTokenParts(`v4.public.${body}.`)).toEqual({
      ok: false,
      error: { code: 'malformed_token' },
    })
    expect(parseTokenParts('v4.public.')).toEqual({ ok: false, error: { code: 'malformed_token' } })
  })

  it('test_body_shorter_than_a_signature_is_malformed', () => {
    expect(parseTokenParts(`v4.public.${encodeBase64Url(new Uint8Array(63))}`)).toEqual({
      ok: false,
      error: { code: 'malformed_token' },
    })
  })

  it('test_splits_message_signature_and_footer', () => {
    const message = utf8.encode('{}')
    const signature = new Uint8Array(64).fill(7)
    const token = `v4.public.${encodeBase64Url(Buffer.concat([message, signature]))}.${encodeBase64Url(utf8.encode('f'))}`
    const parts = parseTokenParts(token)
    expect(parts.ok).toBe(true)
    if (parts.ok) {
      expect(parts.value.message).toEqual(message)
      expect(parts.value.signature).toEqual(signature)
      expect(parts.value.footer).toEqual(utf8.encode('f'))
    }
  })
})
