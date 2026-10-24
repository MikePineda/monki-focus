// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/**
 * A single streaming pass over JSON text that finds an object with the same
 * key twice. Parsers disagree on duplicates (first wins, last wins, error),
 * so a signed pack could mean one thing to the schema validator and another
 * to the decoder; such a pack is refused before either sees it.
 *
 * Keys are compared after unescaping (`"a"` and `"a"` collide). Nesting
 * is bounded by [MAX_DEPTH]; anything that is not well-formed JSON is
 * reported as [Outcome.MALFORMED].
 */
object DuplicateKeyScan {
    enum class Outcome { UNIQUE, DUPLICATE, MALFORMED }

    const val MAX_DEPTH = 64

    fun scan(text: String): Outcome =
        try {
            val reader = Reader(text)
            reader.value(depth = 0)
            reader.skipWhitespace()
            if (reader.atEnd()) Outcome.UNIQUE else Outcome.MALFORMED
        } catch (_: Duplicate) {
            Outcome.DUPLICATE
        } catch (_: Malformed) {
            Outcome.MALFORMED
        }

    private class Duplicate : RuntimeException()

    private class Malformed : RuntimeException()

    private class Reader(
        private val text: String,
    ) {
        private var position = 0

        fun atEnd(): Boolean = position == text.length

        fun skipWhitespace() {
            while (position < text.length && text[position] in " \t\n\r") position++
        }

        fun value(depth: Int) {
            if (depth > MAX_DEPTH) throw Malformed()
            skipWhitespace()
            when (peek()) {
                '{' -> objectValue(depth)
                '[' -> arrayValue(depth)
                '"' -> string()
                't' -> literal("true")
                'f' -> literal("false")
                'n' -> literal("null")
                else -> number()
            }
        }

        private fun objectValue(depth: Int) {
            position++
            val keys = HashSet<String>()
            skipWhitespace()
            if (peek() == '}') {
                position++
                return
            }
            while (true) {
                skipWhitespace()
                if (peek() != '"') throw Malformed()
                if (!keys.add(string())) throw Duplicate()
                skipWhitespace()
                expect(':')
                value(depth + 1)
                skipWhitespace()
                when (next()) {
                    ',' -> continue
                    '}' -> return
                    else -> throw Malformed()
                }
            }
        }

        private fun arrayValue(depth: Int) {
            position++
            skipWhitespace()
            if (peek() == ']') {
                position++
                return
            }
            while (true) {
                value(depth + 1)
                skipWhitespace()
                when (next()) {
                    ',' -> continue
                    ']' -> return
                    else -> throw Malformed()
                }
            }
        }

        /** Reads a string literal and returns its unescaped value. */
        private fun string(): String {
            expect('"')
            val out = StringBuilder()
            while (true) {
                val c = next()
                when {
                    c == '"' -> return out.toString()
                    c == '\\' -> out.append(escape())
                    c < ' ' -> throw Malformed()
                    else -> out.append(c)
                }
            }
        }

        private fun escape(): Char =
            when (next()) {
                '"' -> {
                    '"'
                }

                '\\' -> {
                    '\\'
                }

                '/' -> {
                    '/'
                }

                'b' -> {
                    '\b'
                }

                'f' -> {
                    '\u000C'
                }

                'n' -> {
                    '\n'
                }

                'r' -> {
                    '\r'
                }

                't' -> {
                    '\t'
                }

                'u' -> {
                    if (position + 4 > text.length) throw Malformed()
                    val hex = text.substring(position, position + 4)
                    position += 4
                    if (!hex.all { it in HEX_DIGITS }) throw Malformed()
                    hex.toInt(16).toChar()
                }

                else -> {
                    throw Malformed()
                }
            }

        private fun literal(word: String) {
            if (!text.startsWith(word, position)) throw Malformed()
            position += word.length
        }

        private fun number() {
            val start = position
            while (position < text.length && text[position] in "+-0123456789.eE") position++
            if (!NUMBER.matches(text.substring(start, position))) throw Malformed()
        }

        private fun expect(c: Char) {
            if (next() != c) throw Malformed()
        }

        private fun peek(): Char = if (position < text.length) text[position] else throw Malformed()

        private fun next(): Char = peek().also { position++ }
    }

    private val NUMBER = Regex("""-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?""")
    private const val HEX_DIGITS = "0123456789abcdefABCDEF"
}
