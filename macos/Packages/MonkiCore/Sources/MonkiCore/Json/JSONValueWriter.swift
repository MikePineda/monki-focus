// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Serialises a `JSONValue` as compact UTF-8 JSON: no whitespace, object
/// keys sorted by code unit (deterministic output), integral numbers without
/// a fraction, `/` and non-ASCII left as they are, control characters
/// escaped. The output never contains a raw line feed, so it is a valid
/// NDJSON line.
public enum JSONValueWriter {
    public static func data(_ value: JSONValue) -> Data {
        var output = ""
        write(value, into: &output)
        return Data(output.utf8)
    }

    public static func string(_ value: JSONValue) -> String {
        var output = ""
        write(value, into: &output)
        return output
    }

    private static func write(_ value: JSONValue, into output: inout String) {
        switch value {
        case .null:
            output += "null"
        case .bool(let flag):
            output += flag ? "true" : "false"
        case .number(let number):
            output += format(number)
        case .string(let text):
            writeString(text, into: &output)
        case .array(let items):
            output += "["
            for (index, item) in items.enumerated() {
                if index > 0 { output += "," }
                write(item, into: &output)
            }
            output += "]"
        case .object(let members):
            output += "{"
            for (index, key) in members.keys.sorted(by: { $0.utf16.lexicographicallyPrecedes($1.utf16) })
                .enumerated()
            {
                if index > 0 { output += "," }
                writeString(key, into: &output)
                output += ":"
                if let member = members[key] {
                    write(member, into: &output)
                }
            }
            output += "}"
        }
    }

    /// Integers up to 2^53 print as integers; anything else as Swift's shortest round-trip form.
    private static func format(_ number: Double) -> String {
        if number == number.rounded(), abs(number) <= 9_007_199_254_740_992 {
            return String(Int64(number))
        }
        return String(number)
    }

    private static func writeString(_ text: String, into output: inout String) {
        output += "\""
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\"": output += "\\\""
            case "\\": output += "\\\\"
            case "\n": output += "\\n"
            case "\r": output += "\\r"
            case "\t": output += "\\t"
            case "\u{08}": output += "\\b"
            case "\u{0C}": output += "\\f"
            default:
                if scalar.value < 0x20 {
                    output += String(format: "\\u%04x", scalar.value)
                } else {
                    output.unicodeScalars.append(scalar)
                }
            }
        }
        output += "\""
    }
}
