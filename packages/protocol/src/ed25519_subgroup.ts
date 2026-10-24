// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Prime-order subgroup check for an Ed25519 point encoding: decode the point
 * (RFC 8032 §5.1.3) and test [L]P = identity with plain BigInt arithmetic on
 * extended twisted Edwards coordinates.
 *
 * Platform libraries expose no such check, and they differ on whether points
 * with a torsion component ("mixed order") pass (cofactored versus
 * cofactorless equations). Rejecting mixed-order public keys (at pinning)
 * and mixed-order R values (per signature) makes every platform give the
 * same verdict. Not constant time: it only ever sees public data.
 */
const P = (1n << 255n) - 19n
const L = (1n << 252n) + 27742317777372353535851937790883648493n

function mod(value: bigint): bigint {
  const result = value % P
  return result >= 0n ? result : result + P
}

function power(base: bigint, exponent: bigint): bigint {
  let result = 1n
  let factor = mod(base)
  let remaining = exponent
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = mod(result * factor)
    factor = mod(factor * factor)
    remaining >>= 1n
  }
  return result
}

const D = mod(-121665n * power(121666n, P - 2n))
const SQRT_M1 = power(2n, (P - 1n) / 4n)

interface Point {
  readonly x: bigint
  readonly y: bigint
  readonly z: bigint
  readonly t: bigint
}

/** RFC 8032 §5.1.3 decoding; `null` for an invalid or non-canonical encoding. */
function decode(encoding: Uint8Array): Point | null {
  if (encoding.byteLength !== 32) return null
  let y = 0n
  for (let index = 31; index >= 0; index--) {
    y = (y << 8n) | BigInt(encoding[index] ?? 0)
  }
  const sign = y >> 255n
  y &= (1n << 255n) - 1n
  if (y >= P) return null
  const u = mod(y * y - 1n)
  const v = mod(D * y * y + 1n)
  let x = mod(u * power(v, 3n) * power(u * power(v, 7n), (P - 5n) / 8n))
  const check = mod(v * x * x)
  if (check === mod(-u)) {
    x = mod(x * SQRT_M1)
  } else if (check !== u) {
    return null
  }
  if (x === 0n && sign === 1n) return null
  if ((x & 1n) !== sign) x = P - x
  return { x, y, z: 1n, t: mod(x * y) }
}

// add-2008-hwcd-3 for a = -1.
function add(a: Point, b: Point): Point {
  const pa = mod((a.y - a.x) * (b.y - b.x))
  const pb = mod((a.y + a.x) * (b.y + b.x))
  const pc = mod(2n * D * a.t * b.t)
  const pd = mod(2n * a.z * b.z)
  const e = pb - pa
  const f = pd - pc
  const g = pd + pc
  const h = pb + pa
  return { x: mod(e * f), y: mod(g * h), z: mod(f * g), t: mod(e * h) }
}

function multiply(point: Point, scalar: bigint): Point {
  let result: Point = { x: 0n, y: 1n, z: 1n, t: 0n }
  let addend = point
  let remaining = scalar
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) result = add(result, addend)
    addend = add(addend, addend)
    remaining >>= 1n
  }
  return result
}

/** True when the encoding decodes to a point of the prime-order subgroup (identity included). */
export function isInPrimeOrderSubgroup(encoding: Uint8Array): boolean {
  const point = decode(encoding)
  if (point === null) return false
  const product = multiply(point, L)
  return product.x === 0n && product.y === product.z
}
