// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Why text is not strict JSON.
public enum JSONSyntaxError: Error, Equatable, Sendable {
    /// Not RFC 8259 JSON (comments, trailing commas, `NaN`, bad escapes, trailing text, …).
    case invalid(offset: Int)
    /// An object names the same key twice; `JSON.parse` would silently keep the last one.
    case duplicateKey(String)
    /// Nested deeper than ``StrictJSONParser/maxDepth``.
    case tooDeep
}

/// An RFC 8259 parser that is stricter than `JSONSerialization` and
/// `JSONDecoder`: duplicate object keys, lone surrogate escapes, control
/// characters in strings, leading zeros and trailing text are all errors.
/// Rules documents decode only after passing it, so a key can never be
/// shadowed by a second copy of itself.
public enum StrictJSONParser {
    /// Deeper documents are rejected instead of risking the stack.
    public static let maxDepth = 256

    public static func parse(_ text: String) throws(JSONSyntaxError) -> JSONValue {
        try parse(Data(text.utf8))
    }

    public static func parse(_ data: Data) throws(JSONSyntaxError) -> JSONValue {
        var reader = Reader(bytes: [UInt8](data))
        reader.skipWhitespace()
        let value = try reader.value(depth: 0)
        reader.skipWhitespace()
        guard reader.atEnd else { throw .invalid(offset: reader.offset) }
        return value
    }

    private struct Reader {
        let bytes: [UInt8]
        var offset = 0

        init(bytes: [UInt8]) {
            self.bytes = bytes
        }

        var atEnd: Bool { offset >= bytes.count }

        func peek() -> UInt8? { offset < bytes.count ? bytes[offset] : nil }

        mutating func skipWhitespace() {
            while let byte = peek(), byte == 0x20 || byte == 0x09 || byte == 0x0A || byte == 0x0D {
                offset += 1
            }
        }

        mutating func expect(_ literal: String) throws(JSONSyntaxError) {
            for byte in literal.utf8 {
                guard peek() == byte else { throw .invalid(offset: offset) }
                offset += 1
            }
        }

        mutating func value(depth: Int) throws(JSONSyntaxError) -> JSONValue {
            guard depth < StrictJSONParser.maxDepth else { throw .tooDeep }
            guard let byte = peek() else { throw .invalid(offset: offset) }
            switch byte {
            case UInt8(ascii: "{"):
                return try object(depth: depth)
            case UInt8(ascii: "["):
                return try array(depth: depth)
            case UInt8(ascii: "\""):
                return .string(try string())
            case UInt8(ascii: "t"):
                try expect("true")
                return .bool(true)
            case UInt8(ascii: "f"):
                try expect("false")
                return .bool(false)
            case UInt8(ascii: "n"):
                try expect("null")
                return .null
            default:
                return .number(try number())
            }
        }

        mutating func object(depth: Int) throws(JSONSyntaxError) -> JSONValue {
            offset += 1
            var members: [String: JSONValue] = [:]
            skipWhitespace()
            if peek() == UInt8(ascii: "}") {
                offset += 1
                return .object(members)
            }
            while true {
                skipWhitespace()
                guard peek() == UInt8(ascii: "\"") else { throw .invalid(offset: offset) }
                let key = try string()
                skipWhitespace()
                guard peek() == UInt8(ascii: ":") else { throw .invalid(offset: offset) }
                offset += 1
                skipWhitespace()
                let child = try value(depth: depth + 1)
                guard members.updateValue(child, forKey: key) == nil else { throw .duplicateKey(key) }
                skipWhitespace()
                switch peek() {
                case UInt8(ascii: ","):
                    offset += 1
                case UInt8(ascii: "}"):
                    offset += 1
                    return .object(members)
                default:
                    throw .invalid(offset: offset)
                }
            }
        }

        mutating func array(depth: Int) throws(JSONSyntaxError) -> JSONValue {
            offset += 1
            var items: [JSONValue] = []
            skipWhitespace()
            if peek() == UInt8(ascii: "]") {
                offset += 1
                return .array(items)
            }
            while true {
                skipWhitespace()
                items.append(try value(depth: depth + 1))
                skipWhitespace()
                switch peek() {
                case UInt8(ascii: ","):
                    offset += 1
                case UInt8(ascii: "]"):
                    offset += 1
                    return .array(items)
                default:
                    throw .invalid(offset: offset)
                }
            }
        }

        mutating func hexQuad() throws(JSONSyntaxError) -> UInt32 {
            var value: UInt32 = 0
            for _ in 0..<4 {
                guard let byte = peek(), let digit = Self.hexDigit(byte) else { throw .invalid(offset: offset) }
                value = value * 16 + digit
                offset += 1
            }
            return value
        }

        static func hexDigit(_ byte: UInt8) -> UInt32? {
            switch byte {
            case UInt8(ascii: "0")...UInt8(ascii: "9"): UInt32(byte - UInt8(ascii: "0"))
            case UInt8(ascii: "a")...UInt8(ascii: "f"): UInt32(byte - UInt8(ascii: "a") + 10)
            case UInt8(ascii: "A")...UInt8(ascii: "F"): UInt32(byte - UInt8(ascii: "A") + 10)
            default: nil
            }
        }

        mutating func escape(into scalars: inout String.UnicodeScalarView) throws(JSONSyntaxError) {
            guard let byte = peek() else { throw .invalid(offset: offset) }
            offset += 1
            let simple: [UInt8: Unicode.Scalar] = [
                UInt8(ascii: "\""): "\"", UInt8(ascii: "\\"): "\\", UInt8(ascii: "/"): "/",
                UInt8(ascii: "b"): "\u{08}", UInt8(ascii: "f"): "\u{0C}", UInt8(ascii: "n"): "\n",
                UInt8(ascii: "r"): "\r", UInt8(ascii: "t"): "\t",
            ]
            if let scalar = simple[byte] {
                scalars.append(scalar)
                return
            }
            guard byte == UInt8(ascii: "u") else { throw .invalid(offset: offset - 1) }
            let unit = try hexQuad()
            switch unit {
            case 0xD800...0xDBFF:
                // A high surrogate must be followed by an escaped low surrogate.
                guard peek() == UInt8(ascii: "\\") else { throw .invalid(offset: offset) }
                offset += 1
                guard peek() == UInt8(ascii: "u") else { throw .invalid(offset: offset) }
                offset += 1
                let low = try hexQuad()
                guard (0xDC00...0xDFFF).contains(low),
                    let scalar = Unicode.Scalar(0x10000 + ((unit - 0xD800) << 10) + (low - 0xDC00))
                else { throw .invalid(offset: offset) }
                scalars.append(scalar)
            case 0xDC00...0xDFFF:
                throw .invalid(offset: offset)
            default:
                guard let scalar = Unicode.Scalar(unit) else { throw .invalid(offset: offset) }
                scalars.append(scalar)
            }
        }

        mutating func string() throws(JSONSyntaxError) -> String {
            offset += 1
            var result = String.UnicodeScalarView()
            var runStart = offset
            func flushRun(_ reader: Reader, _ end: Int, into view: inout String.UnicodeScalarView)
                throws(JSONSyntaxError)
            {
                guard end > runStart else { return }
                guard let text = String(bytes: reader.bytes[runStart..<end], encoding: .utf8) else {
                    throw .invalid(offset: runStart)
                }
                view.append(contentsOf: text.unicodeScalars)
            }
            while true {
                guard let byte = peek() else { throw .invalid(offset: offset) }
                switch byte {
                case UInt8(ascii: "\""):
                    try flushRun(self, offset, into: &result)
                    offset += 1
                    return String(result)
                case UInt8(ascii: "\\"):
                    try flushRun(self, offset, into: &result)
                    offset += 1
                    try escape(into: &result)
                    runStart = offset
                case 0x00..<0x20:
                    throw .invalid(offset: offset)
                default:
                    offset += 1
                }
            }
        }

        mutating func digits() -> Int {
            let start = offset
            while let byte = peek(), (UInt8(ascii: "0")...UInt8(ascii: "9")).contains(byte) {
                offset += 1
            }
            return offset - start
        }

        mutating func number() throws(JSONSyntaxError) -> Double {
            let start = offset
            if peek() == UInt8(ascii: "-") { offset += 1 }
            if peek() == UInt8(ascii: "0") {
                offset += 1
            } else {
                guard digits() > 0 else { throw .invalid(offset: offset) }
            }
            if peek() == UInt8(ascii: ".") {
                offset += 1
                guard digits() > 0 else { throw .invalid(offset: offset) }
            }
            if peek() == UInt8(ascii: "e") || peek() == UInt8(ascii: "E") {
                offset += 1
                if peek() == UInt8(ascii: "+") || peek() == UInt8(ascii: "-") { offset += 1 }
                guard digits() > 0 else { throw .invalid(offset: offset) }
            }
            guard let text = String(bytes: bytes[start..<offset], encoding: .utf8), let value = Double(text),
                value.isFinite
            else { throw .invalid(offset: start) }
            return value
        }
    }
}
