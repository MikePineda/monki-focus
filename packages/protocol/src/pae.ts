// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Pre-Authentication Encoding (PASETO spec, "Common" section):
 *
 *   PAE(pieces) = LE64(count) || for each piece: LE64(len(piece)) || piece
 *
 * LE64 is the length as an unsigned 64-bit little-endian integer with the
 * most significant bit cleared. PAE makes the signed message unambiguous:
 * no choice of header, payload, footer and implicit assertion can produce the
 * same byte string as a different choice.
 */
export function le64(value: number): Uint8Array {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('LE64 takes a non-negative safe integer')
  }
  const out = new Uint8Array(8)
  const view = new DataView(out.buffer)
  // Clearing the top bit is a no-op for safe integers (< 2^53) but kept
  // explicit to mirror the spec for implementers on other platforms.
  view.setBigUint64(0, BigInt(value) & 0x7fff_ffff_ffff_ffffn, true)
  return out
}

export function pae(pieces: readonly Uint8Array[]): Uint8Array {
  let total = 8
  for (const piece of pieces) {
    total += 8 + piece.byteLength
  }
  const out = new Uint8Array(total)
  out.set(le64(pieces.length), 0)
  let offset = 8
  for (const piece of pieces) {
    out.set(le64(piece.byteLength), offset)
    offset += 8
    out.set(piece, offset)
    offset += piece.byteLength
  }
  return out
}
