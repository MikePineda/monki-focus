// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.domain.engine

import java.text.Normalizer

/**
 * The part of the WHATWG URL Standard `normalizeUrl` needs (SEMANTICS.md §2
 * step 4): the basic URL parser for the special schemes `http` and `https`
 * without a base URL, returning the serialised `hostname` and `pathname` the
 * TypeScript engine reads from `new URL(text)` (Node 24, ada). User info, port,
 * query and fragment are parsed only as far as needed to find and validate the
 * host. `java.net.URI` is not used: its grammar (RFC 2396) rejects text that
 * browsers accept and keeps dot segments.
 *
 * Host processing follows the standard's domain-to-ASCII with UTS #46
 * non-transitional mapping approximated by per-code-point lower-casing, NFKC
 * and the removal of default-ignorable code points, then Punycode. Hosts that
 * end in a number (IPv4) and IPv6 literals fail here: §2 step 5 rejects them
 * either way, so the outcome (`invalid_host`) is the same.
 */
internal object WhatwgUrl {
    /** The serialised host and path of a parsed URL. */
    data class Parsed(
        val hostname: String,
        val pathname: String,
    )

    /** The parsed URL, or null when WHATWG parsing fails (or the scheme is not http/https). */
    fun parse(text: String): Parsed? {
        val input = text.trim { it.code <= 0x20 }.filterNot { it == '\t' || it == '\n' || it == '\r' }
        val colon = schemeEnd(input) ?: return null
        val scheme = input.substring(0, colon).lowercase()
        if (scheme != "http" && scheme != "https") return null
        var pointer = colon + 1
        // Special authority (ignore) slashes: any run of `/` and `\`.
        while (pointer < input.length && (input[pointer] == '/' || input[pointer] == '\\')) pointer += 1
        val authorityEnd = indexOfAny(input, pointer, "/\\?#")
        val authority = input.substring(pointer, authorityEnd)
        val at = authority.lastIndexOf('@')
        if (at >= 0 && at == authority.length - 1) return null
        val hostAndPort = authority.substring(at + 1)
        val hostname = hostOf(hostAndPort) ?: return null
        return Parsed(hostname, pathOf(input, authorityEnd))
    }

    private fun schemeEnd(input: String): Int? {
        if (input.isEmpty() || !input[0].isAsciiLetter()) return null
        var index = 1
        while (index < input.length && (input[index].isAsciiLetterOrDigit() || input[index] in "+-.")) index += 1
        return if (index < input.length && input[index] == ':') index else null
    }

    private fun indexOfAny(
        input: String,
        from: Int,
        terminators: String,
    ): Int {
        var index = from
        while (index < input.length && input[index] !in terminators) index += 1
        return index
    }

    /** Host and port state: split off a valid port, then parse the host. */
    private fun hostOf(hostAndPort: String): String? {
        var insideBrackets = false
        var colon = -1
        for ((index, c) in hostAndPort.withIndex()) {
            when {
                c == '[' -> {
                    insideBrackets = true
                }

                c == ']' -> {
                    insideBrackets = false
                }

                c == ':' && !insideBrackets -> {
                    colon = index
                    break
                }
            }
        }
        val host = if (colon < 0) hostAndPort else hostAndPort.substring(0, colon)
        if (host.isEmpty()) return null
        if (colon >= 0) {
            val port = hostAndPort.substring(colon + 1)
            if (!port.all { it in '0'..'9' }) return null
            if (port.isNotEmpty() && port.trimStart('0').length > 5) return null
            if (port.isNotEmpty() && port.toInt() > 65_535) return null
        }
        return parseHost(host)
    }

    private fun parseHost(input: String): String? {
        // IPv6 literal: never a domain, so §2 step 5 rejects it anyway.
        if (input.startsWith('[')) return null
        val domain = String(percentDecode(input), Charsets.UTF_8)
        val ascii = domainToAscii(domain) ?: return null
        if (ascii.any(::isForbiddenDomainCodePoint)) return null
        // A host that ends in a number is an IPv4 address (or fails as one): rejected either way.
        if (endsInANumber(ascii)) return null
        return ascii
    }

    private fun domainToAscii(domain: String): String? {
        val isAsciiFastPath =
            domain.all { it.code < 0x80 } && domain.split('.').none { it.lowercase().startsWith("xn--") }
        if (isAsciiFastPath) return asciiLower(domain).takeIf { it.isNotEmpty() }
        val mapped = uts46Map(domain)
        // Invalid UTF-8 decodes to U+FFFD, which UTS #46 disallows.
        if ('\uFFFD' in mapped) return null
        val labels = mapped.split('.')
        val result = labels.joinToString(".") { label -> if (label.all { it.code < 0x80 }) label else "xn--" + Punycode.encode(label) }
        return result.takeIf { it.isNotEmpty() }
    }

    /** UTS #46 mapping, approximated: full-stop variants to `.`, ignorables dropped, lower case, NFKC. */
    private fun uts46Map(domain: String): String {
        val folded = StringBuilder()
        domain.codePoints().forEach { codePoint ->
            when {
                codePoint == 0x3002 || codePoint == 0xFF0E || codePoint == 0xFF61 -> folded.append('.')
                isDefaultIgnorable(codePoint) -> Unit
                else -> folded.appendCodePoint(Character.toLowerCase(codePoint))
            }
        }
        val normalised = Normalizer.normalize(folded, Normalizer.Form.NFKC)
        val lowered = StringBuilder()
        normalised.codePoints().forEach { lowered.appendCodePoint(Character.toLowerCase(it)) }
        return lowered.toString()
    }

    private fun isDefaultIgnorable(codePoint: Int): Boolean =
        codePoint == 0x00AD ||
            codePoint == 0x034F ||
            codePoint in 0x180B..0x180F ||
            codePoint in 0x200B..0x200D ||
            codePoint == 0x2060 ||
            codePoint in 0xFE00..0xFE0F ||
            codePoint == 0xFEFF

    private fun endsInANumber(host: String): Boolean {
        val labels = host.split('.').toMutableList()
        if (labels.last().isEmpty()) {
            if (labels.size == 1) return false
            labels.removeAt(labels.size - 1)
        }
        val last = labels.last()
        if (last.isNotEmpty() && last.all { it in '0'..'9' }) return true
        val hex = last.lowercase()
        return hex.startsWith("0x") && hex.substring(2).all { it in '0'..'9' || it in 'a'..'f' }
    }

    private fun isForbiddenDomainCodePoint(c: Char): Boolean = c.code <= 0x20 || c.code == 0x7F || c in "#%/:<>?@[\\]^|"

    /** Path start and path states: dot segments resolved, code points percent-encoded, up to `?` or `#`. */
    private fun pathOf(
        input: String,
        from: Int,
    ): String {
        val segments = ArrayList<String>()
        var pointer = from
        if (pointer < input.length && (input[pointer] == '/' || input[pointer] == '\\')) pointer += 1
        val buffer = StringBuilder()
        while (true) {
            val c = if (pointer < input.length) input[pointer] else null
            if (c == null || c == '/' || c == '\\' || c == '?' || c == '#') {
                val segment = buffer.toString()
                val slash = c == '/' || c == '\\'
                when {
                    isDoubleDot(segment) -> {
                        if (segments.isNotEmpty()) segments.removeAt(segments.size - 1)
                        if (!slash) segments.add("")
                    }

                    isSingleDot(segment) -> {
                        if (!slash) segments.add("")
                    }

                    else -> {
                        segments.add(segment)
                    }
                }
                buffer.setLength(0)
                if (!slash) break
            } else {
                val codePoint = Character.codePointAt(input, pointer)
                appendPercentEncoded(buffer, codePoint)
                pointer += Character.charCount(codePoint) - 1
            }
            pointer += 1
        }
        return "/" + segments.joinToString("/")
    }

    private fun isSingleDot(segment: String): Boolean = segment == "." || segment.lowercase() == "%2e"

    private fun isDoubleDot(segment: String): Boolean = segment.lowercase() in setOf("..", ".%2e", "%2e.", "%2e%2e")

    private fun appendPercentEncoded(
        buffer: StringBuilder,
        codePoint: Int,
    ) {
        val inPathSet = codePoint <= 0x20 || codePoint > 0x7E || codePoint.toChar() in "\"#<>?^`{}"
        if (!inPathSet) {
            buffer.append(codePoint.toChar())
            return
        }
        // Lone surrogates encode as U+FFFD, like a UTF-8 encoder does.
        val scalar = if (codePoint in 0xD800..0xDFFF) 0xFFFD else codePoint
        for (byte in String(Character.toChars(scalar)).toByteArray(Charsets.UTF_8)) {
            buffer.append('%').append(HEX[(byte.toInt() shr 4) and 0xF]).append(HEX[byte.toInt() and 0xF])
        }
    }

    private fun percentDecode(input: String): ByteArray {
        val bytes = input.toByteArray(Charsets.UTF_8)
        val out = ByteArray(bytes.size)
        var size = 0
        var index = 0
        while (index < bytes.size) {
            val byte = bytes[index]
            val escaped = byte == '%'.code.toByte() && index + 2 < bytes.size
            val high = if (escaped) hexValue(bytes[index + 1]) else -1
            val low = if (escaped) hexValue(bytes[index + 2]) else -1
            if (high >= 0 && low >= 0) {
                out[size++] = (high * 16 + low).toByte()
                index += 3
            } else {
                out[size++] = byte
                index += 1
            }
        }
        return out.copyOf(size)
    }

    private fun hexValue(byte: Byte): Int =
        when (val c = byte.toInt().toChar()) {
            in '0'..'9' -> c - '0'
            in 'a'..'f' -> c - 'a' + 10
            in 'A'..'F' -> c - 'A' + 10
            else -> -1
        }

    private fun Char.isAsciiLetter(): Boolean = this in 'a'..'z' || this in 'A'..'Z'

    private fun Char.isAsciiLetterOrDigit(): Boolean = isAsciiLetter() || this in '0'..'9'

    private const val HEX = "0123456789ABCDEF"
}
