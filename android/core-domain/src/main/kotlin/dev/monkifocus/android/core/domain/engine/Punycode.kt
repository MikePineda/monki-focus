// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

/**
 * Punycode encoding of one domain label (RFC 3492), the last step of the
 * WHATWG host's domain-to-ASCII. `java.net.IDN` is not used: it implements
 * IDNA 2003, which maps `ß` to `ss` where browsers keep it (`xn--zca`).
 */
internal object Punycode {
    private const val BASE = 36
    private const val T_MIN = 1
    private const val T_MAX = 26
    private const val SKEW = 38
    private const val DAMP = 700
    private const val INITIAL_BIAS = 72
    private const val INITIAL_N = 0x80

    /** The Punycode of a label, without the `xn--` prefix. */
    fun encode(label: String): String {
        val input = label.codePoints().toArray()
        val output = StringBuilder()
        for (codePoint in input) if (codePoint < 0x80) output.append(codePoint.toChar())
        val basicCount = output.length
        var handled = basicCount
        if (basicCount > 0) output.append('-')
        var n = INITIAL_N
        var delta = 0L
        var bias = INITIAL_BIAS
        while (handled < input.size) {
            val next = input.filter { it >= n }.min()
            delta += (next - n).toLong() * (handled + 1)
            n = next
            for (codePoint in input) {
                if (codePoint < n) delta += 1
                if (codePoint == n) {
                    var q = delta
                    var k = BASE
                    while (true) {
                        val t = threshold(k, bias)
                        if (q < t) break
                        output.append(digit((t + (q - t) % (BASE - t)).toInt()))
                        q = (q - t) / (BASE - t)
                        k += BASE
                    }
                    output.append(digit(q.toInt()))
                    bias = adapt(delta, handled + 1, handled == basicCount)
                    delta = 0
                    handled += 1
                }
            }
            delta += 1
            n += 1
        }
        return output.toString()
    }

    private fun threshold(
        k: Int,
        bias: Int,
    ): Long =
        when {
            k <= bias -> T_MIN.toLong()
            k >= bias + T_MAX -> T_MAX.toLong()
            else -> (k - bias).toLong()
        }

    private fun digit(value: Int): Char = if (value < 26) 'a' + value else '0' + (value - 26)

    private fun adapt(
        delta: Long,
        points: Int,
        first: Boolean,
    ): Int {
        var d = if (first) delta / DAMP else delta / 2
        d += d / points
        var k = 0
        while (d > ((BASE - T_MIN) * T_MAX) / 2) {
            d /= BASE - T_MIN
            k += BASE
        }
        return (k + (BASE - T_MIN + 1) * d / (d + SKEW)).toInt()
    }
}
