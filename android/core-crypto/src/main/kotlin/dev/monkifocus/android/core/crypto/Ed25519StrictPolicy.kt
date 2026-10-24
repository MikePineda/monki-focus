// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import java.math.BigInteger

/**
 * The project's strict Ed25519 acceptance policy, the same on every platform
 * (`packages/protocol/src/ed25519_strict.ts`, docs/protocol/unlock-tokens.md
 * §1.1), checked explicitly so no library leniency decides a verdict:
 *
 * - point encodings (public key A, signature R) are canonical: y < p and an
 *   x = 0 point never carries the sign bit;
 * - A and R are none of the 8 small-order points and lie in the prime-order
 *   subgroup ([L]P = identity), which rejects mixed-order points;
 * - the scalar S of a signature is below the group order L.
 *
 * With A and R in the prime-order subgroup the cofactored and cofactorless
 * equations agree. Plain BigInteger arithmetic on extended twisted Edwards
 * coordinates; not constant time, it only ever sees public data.
 */
object Ed25519StrictPolicy {
    const val POINT_BYTES = 32
    const val SIGNATURE_BYTES = 64

    private val P: BigInteger = BigInteger.ONE.shiftLeft(255).subtract(BigInteger.valueOf(19))
    private val L: BigInteger = BigInteger.ONE.shiftLeft(252).add(BigInteger("27742317777372353535851937790883648493"))
    private val D: BigInteger = BigInteger.valueOf(-121665).multiply(BigInteger.valueOf(121666).modInverse(P)).mod(P)
    private val SQRT_M1: BigInteger = BigInteger.valueOf(2).modPow(P.subtract(BigInteger.ONE).shiftRight(2), P)
    private val TWO_D: BigInteger = D.shiftLeft(1).mod(P)

    /** Small-order point encodings with the sign bit cleared (hex, little-endian as encoded). */
    private val SMALL_ORDER_MASKED =
        setOf(
            "0000000000000000000000000000000000000000000000000000000000000000",
            "0100000000000000000000000000000000000000000000000000000000000000",
            "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
            "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
            "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
        )

    /** True when [encoding] is a canonical point of the prime-order subgroup other than a small-order point. */
    fun isAcceptablePoint(encoding: ByteArray): Boolean {
        if (encoding.size != POINT_BYTES) return false
        val masked = encoding.copyOf().also { it[31] = (it[31].toInt() and 0x7f).toByte() }
        if (littleEndian(masked) >= P) return false
        if (masked.toHex() in SMALL_ORDER_MASKED) return false
        val point = decode(encoding) ?: return false
        val product = multiply(point, L)
        return product.x.signum() == 0 && product.y == product.z
    }

    /** True when the scalar half of a 64-byte signature is below L. */
    fun isCanonicalScalar(signature: ByteArray): Boolean =
        signature.size == SIGNATURE_BYTES && littleEndian(signature.copyOfRange(32, 64)) < L

    /** True when a 64-byte signature has an acceptable R and a canonical S. */
    fun isAcceptableSignature(signature: ByteArray): Boolean =
        signature.size == SIGNATURE_BYTES && isAcceptablePoint(signature.copyOfRange(0, 32)) && isCanonicalScalar(signature)

    private class Point(
        val x: BigInteger,
        val y: BigInteger,
        val z: BigInteger,
        val t: BigInteger,
    )

    private fun littleEndian(bytes: ByteArray): BigInteger = BigInteger(1, bytes.reversedArray())

    private fun ByteArray.toHex(): String =
        joinToString("") { byte -> HEX[(byte.toInt() shr 4) and 0x0f].toString() + HEX[byte.toInt() and 0x0f] }

    private const val HEX = "0123456789abcdef"

    /** RFC 8032 §5.1.3 decoding; null for an invalid or non-canonical encoding. */
    private fun decode(encoding: ByteArray): Point? {
        val raw = littleEndian(encoding)
        val sign = raw.testBit(255)
        val y = raw.clearBit(255)
        if (y >= P) return null
        val u = y.multiply(y).subtract(BigInteger.ONE).mod(P)
        val v =
            D
                .multiply(y)
                .multiply(y)
                .add(BigInteger.ONE)
                .mod(P)
        val v3 = v.modPow(BigInteger.valueOf(3), P)
        val v7 = v.modPow(BigInteger.valueOf(7), P)
        var x = u.multiply(v3).multiply(u.multiply(v7).mod(P).modPow(P.subtract(BigInteger.valueOf(5)).shiftRight(3), P)).mod(P)
        val check = v.multiply(x).multiply(x).mod(P)
        when (check) {
            u -> Unit
            u.negate().mod(P) -> x = x.multiply(SQRT_M1).mod(P)
            else -> return null
        }
        if (x.signum() == 0 && sign) return null
        if (x.testBit(0) != sign) x = P.subtract(x)
        return Point(x, y, BigInteger.ONE, x.multiply(y).mod(P))
    }

    // add-2008-hwcd-3 for a = -1.
    private fun add(
        a: Point,
        b: Point,
    ): Point {
        val pa =
            a.y
                .subtract(a.x)
                .multiply(b.y.subtract(b.x))
                .mod(P)
        val pb =
            a.y
                .add(a.x)
                .multiply(b.y.add(b.x))
                .mod(P)
        val pc = TWO_D.multiply(a.t).multiply(b.t).mod(P)
        val pd =
            a.z
                .multiply(b.z)
                .shiftLeft(1)
                .mod(P)
        val e = pb.subtract(pa)
        val f = pd.subtract(pc)
        val g = pd.add(pc)
        val h = pb.add(pa)
        return Point(e.multiply(f).mod(P), g.multiply(h).mod(P), f.multiply(g).mod(P), e.multiply(h).mod(P))
    }

    private fun multiply(
        point: Point,
        scalar: BigInteger,
    ): Point {
        var result = Point(BigInteger.ZERO, BigInteger.ONE, BigInteger.ONE, BigInteger.ZERO)
        var addend = point
        for (bit in 0 until scalar.bitLength()) {
            if (scalar.testBit(bit)) result = add(result, addend)
            addend = add(addend, addend)
        }
        return result
    }
}
