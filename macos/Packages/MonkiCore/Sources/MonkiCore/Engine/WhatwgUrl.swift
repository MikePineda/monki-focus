// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// The part of the WHATWG URL Standard `normalizeUrl` needs (SEMANTICS.md §2
/// step 4): the basic URL parser for the special schemes `http` and `https`
/// without a base URL, returning the serialised `hostname` and `pathname` the
/// TypeScript engine reads from `new URL(text)` (Node 24, ada). User info,
/// port, query and fragment are parsed only as far as needed to find and
/// validate the host. Foundation's `URL` is not used: it follows RFC 3986,
/// rejects text browsers accept and keeps dot segments.
///
/// Host processing follows the standard's domain-to-ASCII. Foundation has no
/// public UTS #46 API, so the mapping is approximated (as the Kotlin port
/// does, a little closer): full-stop variants, default-ignorable code points,
/// NFKC_Casefold with the non-transitional deviations kept; control, format,
/// private-use and unassigned code points, a leading combining mark, an
/// invalid or non-ASCII `xn--` label and a joiner outside the virama context
/// fail; then Punycode. Not modelled: the CheckBidi rule and the Joining_Type
/// context of ZWNJ (such labels fail). Hosts that end
/// in a number (IPv4) and IPv6 literals fail here: §2 step 5 rejects both
/// either way, so the outcome (`invalid_host`) is the same.
enum WhatwgUrl {
    struct Parsed: Hashable {
        let hostname: String
        let pathname: String
    }

    /// The parsed URL, or nil when WHATWG parsing fails (or the scheme is not http/https).
    static func parse(_ text: String) -> Parsed? {
        var input = Array(text.unicodeScalars)
        while let first = input.first, first.value <= 0x20 { input.removeFirst() }
        while let last = input.last, last.value <= 0x20 { input.removeLast() }
        input.removeAll { $0 == "\t" || $0 == "\n" || $0 == "\r" }
        guard let colon = schemeEnd(input) else { return nil }
        let scheme = asciiLowercased(String(String.UnicodeScalarView(input[0..<colon])))
        guard scheme == "http" || scheme == "https" else { return nil }
        var pointer = colon + 1
        // Special authority (ignore) slashes: any run of `/` and `\`.
        while pointer < input.count, input[pointer] == "/" || input[pointer] == "\\" { pointer += 1 }
        let authorityEnd = input[pointer...].firstIndex { "/\\?#".unicodeScalars.contains($0) } ?? input.count
        let authority = Array(input[pointer..<authorityEnd])
        let at = authority.lastIndex(of: "@")
        if let at, at == authority.count - 1 { return nil }
        let hostAndPort = Array(authority[(at.map { $0 + 1 } ?? 0)...])
        guard let hostname = host(of: hostAndPort) else { return nil }
        return Parsed(hostname: hostname, pathname: path(of: input, from: authorityEnd))
    }

    private static func isAsciiLetter(_ scalar: Unicode.Scalar) -> Bool {
        ("a"..."z").contains(scalar) || ("A"..."Z").contains(scalar)
    }

    private static func isAsciiDigit(_ scalar: Unicode.Scalar) -> Bool {
        ("0"..."9").contains(scalar)
    }

    private static func schemeEnd(_ input: [Unicode.Scalar]) -> Int? {
        guard let first = input.first, isAsciiLetter(first) else { return nil }
        var index = 1
        while index < input.count,
            isAsciiLetter(input[index]) || isAsciiDigit(input[index]) || "+-.".unicodeScalars.contains(input[index])
        {
            index += 1
        }
        return index < input.count && input[index] == ":" ? index : nil
    }

    /// Host and port state: split off a valid port, then parse the host.
    private static func host(of hostAndPort: [Unicode.Scalar]) -> String? {
        var insideBrackets = false
        var colon: Int?
        for (index, scalar) in hostAndPort.enumerated() {
            if scalar == "[" {
                insideBrackets = true
            } else if scalar == "]" {
                insideBrackets = false
            } else if scalar == ":", !insideBrackets {
                colon = index
                break
            }
        }
        let host = Array(hostAndPort[..<(colon ?? hostAndPort.count)])
        guard !host.isEmpty else { return nil }
        if let colon {
            let port = hostAndPort[(colon + 1)...]
            guard port.allSatisfy(isAsciiDigit) else { return nil }
            let significant = port.drop { $0 == "0" }
            guard significant.count <= 5 else { return nil }
            if let value = Int(String(String.UnicodeScalarView(significant))), value > 65_535 { return nil }
        }
        return parseHost(host)
    }

    private static func parseHost(_ input: [Unicode.Scalar]) -> String? {
        // IPv6 literal: never a domain, so §2 step 5 rejects it anyway.
        if input.first == "[" { return nil }
        let bytes = percentDecode(Array(String(String.UnicodeScalarView(input)).utf8))
        // UTF-8 decode without BOM: invalid sequences become U+FFFD, which UTS #46 disallows.
        let domain = String(decoding: bytes, as: UTF8.self)
        guard let ascii = domainToAscii(Array(domain.unicodeScalars)) else { return nil }
        guard !ascii.unicodeScalars.contains(where: isForbiddenDomainCodePoint) else { return nil }
        // A host that ends in a number is an IPv4 address (or fails as one): rejected either way.
        if endsInANumber(ascii) { return nil }
        return ascii
    }

    private static func domainToAscii(_ domain: [Unicode.Scalar]) -> String? {
        if domain.allSatisfy(\.isASCII) {
            // ada's ASCII fast path: lower-cased as is, `xn--` labels included.
            let lowered = asciiLowercased(String(String.UnicodeScalarView(domain)))
            return lowered.isEmpty ? nil : lowered
        }
        guard let mapped = uts46Map(domain) else { return nil }
        var labels: [String] = []
        for label in mapped.split(separator: ".", omittingEmptySubsequences: false) {
            guard let ascii = asciiLabel(Array(label)) else { return nil }
            labels.append(ascii)
        }
        let result = labels.joined(separator: ".")
        return result.isEmpty ? nil : result
    }

    /// One mapped label to ASCII: kept when ASCII (an `xn--` label must decode), else `xn--` + Punycode.
    private static func asciiLabel(_ label: [Unicode.Scalar]) -> String? {
        let text = String(String.UnicodeScalarView(label))
        if let first = label.first, isCombiningMark(first) { return nil }
        let isAceLabel = asciiLowercased(text).hasPrefix("xn--")
        if label.allSatisfy(\.isASCII) {
            // Outside the ASCII fast path an `xn--` label must decode to a valid
            // label: non-ASCII, without disallowed code points, already mapped.
            if isAceLabel {
                guard let decoded = Punycode.decode(String(text.dropFirst(4))), !decoded.isEmpty,
                    !decoded.allSatisfy(\.isASCII), !isCombiningMark(decoded[0]),
                    uts46Map(decoded) == decoded
                else { return nil }
            }
            return text
        }
        guard !isAceLabel, passesCheckJoiners(label), let encoded = Punycode.encode(label) else { return nil }
        return "xn--" + encoded
    }

    /// CheckJoiners (RFC 5892 CONTEXTJ), the virama rule only: ZWNJ and ZWJ
    /// are valid right after a virama. The Joining_Type rule for ZWNJ needs
    /// Unicode data Swift does not expose, so such labels fail here.
    private static func passesCheckJoiners(_ label: [Unicode.Scalar]) -> Bool {
        for (index, scalar) in label.enumerated() where scalar.value == 0x200C || scalar.value == 0x200D {
            guard index > 0, label[index - 1].properties.canonicalCombiningClass == .virama else { return false }
        }
        return true
    }

    private static func isCombiningMark(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.properties.generalCategory {
        case .nonspacingMark, .spacingMark, .enclosingMark: true
        default: false
        }
    }

    /// UTS #46 mapping, approximated: full-stop variants to `.`, ignorables
    /// dropped, then NFKC_Casefold (per-code-point full case folding and NFKC,
    /// to a fixed point) with the non-transitional deviations `ß` and `ς`
    /// kept; nil for a disallowed code point.
    private static func uts46Map(_ domain: [Unicode.Scalar]) -> [Unicode.Scalar]? {
        var mapped: [Unicode.Scalar] = []
        for scalar in domain {
            if scalar.value == 0x3002 || scalar.value == 0xFF0E || scalar.value == 0xFF61 {
                mapped.append(".")
            } else if !isDefaultIgnorable(scalar) {
                mapped.append(scalar)
            }
        }
        for _ in 0..<3 {
            let next = Array(
                String(String.UnicodeScalarView(mapped.flatMap(caseFolded))).precomposedStringWithCompatibilityMapping
                    .unicodeScalars
            )
            if next == mapped { break }
            mapped = next
        }
        guard !mapped.contains(where: isDisallowed) else { return nil }
        return mapped
    }

    /// Full case folding of one code point, keeping the deviations UTS #46
    /// leaves alone in non-transitional processing (`ß`, `ς`).
    private static func caseFolded(_ scalar: Unicode.Scalar) -> [Unicode.Scalar] {
        if scalar.value == 0x00DF || scalar.value == 0x03C2 || scalar.isASCII && !("A"..."Z").contains(scalar) {
            return [scalar]
        }
        return Array(String(scalar).folding(options: .caseInsensitive, locale: nil).unicodeScalars)
    }

    private static func isDefaultIgnorable(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x00AD, 0x034F, 0x180B...0x180F, 0x200B, 0x2060, 0xFE00...0xFE0F, 0xFEFF, 0xE0100...0xE01EF: true
        default: false
        }
    }

    /// Code points UTS #46 never lets through (controls, format characters such
    /// as bidi overrides, private use, unassigned, U+FFFD). ZWNJ and ZWJ are
    /// judged in context (`passesCheckJoiners`).
    private static func isDisallowed(_ scalar: Unicode.Scalar) -> Bool {
        if scalar.value == 0xFFFD { return true }
        if scalar.value == 0x200C || scalar.value == 0x200D { return false }
        switch scalar.properties.generalCategory {
        case .control, .format, .surrogate, .privateUse, .unassigned, .lineSeparator, .paragraphSeparator:
            return scalar.isASCII ? false : true
        default:
            return false
        }
    }

    private static func endsInANumber(_ host: String) -> Bool {
        var labels = host.split(separator: ".", omittingEmptySubsequences: false)
        if labels.last?.isEmpty == true {
            if labels.count == 1 { return false }
            labels.removeLast()
        }
        guard let last = labels.last else { return false }
        if !last.isEmpty, last.unicodeScalars.allSatisfy(isAsciiDigit) { return true }
        let hex = asciiLowercased(last)
        return hex.hasPrefix("0x")
            && hex.unicodeScalars.dropFirst(2).allSatisfy { isAsciiDigit($0) || ("a"..."f").contains($0) }
    }

    private static func isForbiddenDomainCodePoint(_ scalar: Unicode.Scalar) -> Bool {
        scalar.value <= 0x20 || scalar.value == 0x7F || "#%/:<>?@[\\]^|".unicodeScalars.contains(scalar)
    }

    /// Path start and path states: dot segments resolved, code points percent-encoded, up to `?` or `#`.
    private static func path(of input: [Unicode.Scalar], from start: Int) -> String {
        var segments: [String] = []
        var pointer = start
        if pointer < input.count, input[pointer] == "/" || input[pointer] == "\\" { pointer += 1 }
        var buffer = ""
        while true {
            let scalar: Unicode.Scalar? = pointer < input.count ? input[pointer] : nil
            if scalar == nil || scalar == "/" || scalar == "\\" || scalar == "?" || scalar == "#" {
                let slash = scalar == "/" || scalar == "\\"
                if isDoubleDot(buffer) {
                    if !segments.isEmpty { segments.removeLast() }
                    if !slash { segments.append("") }
                } else if isSingleDot(buffer) {
                    if !slash { segments.append("") }
                } else {
                    segments.append(buffer)
                }
                buffer = ""
                if !slash { break }
            } else if let scalar {
                appendPercentEncoded(&buffer, scalar)
            }
            pointer += 1
        }
        return "/" + segments.joined(separator: "/")
    }

    private static func isSingleDot(_ segment: String) -> Bool {
        segment == "." || asciiLowercased(segment) == "%2e"
    }

    private static func isDoubleDot(_ segment: String) -> Bool {
        ["..", ".%2e", "%2e.", "%2e%2e"].contains(asciiLowercased(segment))
    }

    private static let hexDigits = Array("0123456789ABCDEF".unicodeScalars)

    private static func appendPercentEncoded(_ buffer: inout String, _ scalar: Unicode.Scalar) {
        let inPathSet = scalar.value <= 0x20 || scalar.value > 0x7E || "\"#<>?^`{}".unicodeScalars.contains(scalar)
        guard inPathSet else {
            buffer.unicodeScalars.append(scalar)
            return
        }
        for byte in String(scalar).utf8 {
            buffer.unicodeScalars.append("%")
            buffer.unicodeScalars.append(hexDigits[Int(byte >> 4)])
            buffer.unicodeScalars.append(hexDigits[Int(byte & 0xF)])
        }
    }

    private static func percentDecode(_ bytes: [UInt8]) -> [UInt8] {
        var output: [UInt8] = []
        output.reserveCapacity(bytes.count)
        var index = 0
        while index < bytes.count {
            if bytes[index] == UInt8(ascii: "%"), index + 2 < bytes.count,
                let high = hexValue(bytes[index + 1]), let low = hexValue(bytes[index + 2])
            {
                output.append(high * 16 + low)
                index += 3
            } else {
                output.append(bytes[index])
                index += 1
            }
        }
        return output
    }

    private static func hexValue(_ byte: UInt8) -> UInt8? {
        switch byte {
        case UInt8(ascii: "0")...UInt8(ascii: "9"): byte - UInt8(ascii: "0")
        case UInt8(ascii: "a")...UInt8(ascii: "f"): byte - UInt8(ascii: "a") + 10
        case UInt8(ascii: "A")...UInt8(ascii: "F"): byte - UInt8(ascii: "A") + 10
        default: nil
        }
    }
}
