// SPDX-License-Identifier: AGPL-3.0-or-later

// `normalizeUrl(urlText, catalog)` (SEMANTICS.md §2): raw URL text, as a tab
// or a mobile URL bar shows it, to `{host, path, pathKnown, surface}` or a
// rejection. Parsing follows WHATWG URL semantics (`WhatwgUrl`).

/// JavaScript's `String.prototype.trim` set: `WhiteSpace` plus `LineTerminator`.
private func isJavaScriptWhitespace(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF: true
    default: false
    }
}

private func javaScriptTrimmed(_ text: String) -> String {
    var scalars = Array(text.unicodeScalars)
    while let first = scalars.first, isJavaScriptWhitespace(first) { scalars.removeFirst() }
    while let last = scalars.last, isJavaScriptWhitespace(last) { scalars.removeLast() }
    return String(String.UnicodeScalarView(scalars))
}

/// The scheme of `^([A-Za-z][A-Za-z0-9+.-]*):`, if the text starts with one.
private func schemeOf(_ text: String) -> String? {
    let scalars = Array(text.unicodeScalars)
    guard let first = scalars.first, ("a"..."z").contains(first) || ("A"..."Z").contains(first) else { return nil }
    var index = 1
    while index < scalars.count {
        let scalar = scalars[index]
        let allowed =
            ("a"..."z").contains(scalar) || ("A"..."Z").contains(scalar) || ("0"..."9").contains(scalar)
            || "+.-".unicodeScalars.contains(scalar)
        guard allowed else { break }
        index += 1
    }
    guard index < scalars.count, scalars[index] == ":" else { return nil }
    return String(String.UnicodeScalarView(scalars[0..<index]))
}

private func isUnreserved(_ scalar: Unicode.Scalar) -> Bool {
    ("A"..."Z").contains(scalar) || ("a"..."z").contains(scalar) || ("0"..."9").contains(scalar)
        || "-._~".unicodeScalars.contains(scalar)
}

private func hexValue(_ scalar: Unicode.Scalar) -> UInt32? {
    switch scalar {
    case "0"..."9": scalar.value - 48
    case "a"..."f": scalar.value - 87
    case "A"..."F": scalar.value - 55
    default: nil
    }
}

/// Escapes of unreserved characters decoded, the hex digits of every other escape upper-cased.
private func normaliseSegment(_ segment: Substring) -> String {
    let scalars = Array(segment.unicodeScalars)
    var output = String.UnicodeScalarView()
    var index = 0
    while index < scalars.count {
        if scalars[index] == "%", index + 2 < scalars.count,
            let high = hexValue(scalars[index + 1]), let low = hexValue(scalars[index + 2]),
            let decoded = Unicode.Scalar(high * 16 + low)
        {
            if isUnreserved(decoded) {
                output.append(decoded)
            } else {
                output.append("%")
                output.append(contentsOf: String(scalars[index + 1]).uppercased().unicodeScalars)
                output.append(contentsOf: String(scalars[index + 2]).uppercased().unicodeScalars)
            }
            index += 3
        } else {
            output.append(scalars[index])
            index += 1
        }
    }
    return String(output)
}

/// A segment that could disguise the real path makes the path unknown (step 7).
private func isAmbiguousSegment(_ segment: String) -> Bool {
    segment.contains("%2F") || segment == "." || segment == ".." || segment.contains(";")
}

private func normaliseHost(_ hostname: String, _ catalog: RulesCatalog) -> String? {
    let host = catalog.normaliseDomain(hostname)
    let labels = host.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.count >= 2, !labels.contains(where: \.isEmpty), let top = labels.last else { return nil }
    let isAlphabetic = top.unicodeScalars.allSatisfy { ("a"..."z").contains($0) }
    let isPunycode =
        top.hasPrefix("xn--") && top.count > 4
        && top.unicodeScalars.allSatisfy { ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "-" }
    return isAlphabetic || isPunycode ? host : nil
}

/// The most specific surface glob of the host's profile that matches the path (step 8).
func resolveSurface(host: String, path: String, _ catalog: RulesCatalog) -> String? {
    guard let profile = catalog.profileForHost(host) else { return nil }
    var best: (surface: String, literals: Int, wildcards: Int)?
    for entry in profile.surfaces {
        for glob in entry.globs where matchesGlob(glob, path) {
            let shape = globShape(glob)
            let better =
                best.map {
                    shape.literals > $0.literals || (shape.literals == $0.literals && shape.wildcards < $0.wildcards)
                }
                ?? true
            if better { best = (entry.surface, shape.literals, shape.wildcards) }
        }
    }
    return best?.surface
}

public func normalizeUrl(_ urlText: String, catalog: RulesCatalog) -> UrlNormalization {
    let text = javaScriptTrimmed(urlText)
    let scheme = schemeOf(text)
    let hasScheme = scheme.map { !$0.contains(".") } ?? false
    if hasScheme, let scheme, !["http", "https"].contains(scheme.lowercased()) {
        return .rejected(.notHttp)
    }
    var pathKnown = hasScheme || text.unicodeScalars.contains { $0 == "/" || $0 == "?" || $0 == "#" }
    guard let url = WhatwgUrl.parse(hasScheme ? text : "https://" + text),
        let host = normaliseHost(url.hostname, catalog)
    else { return .rejected(.invalidHost) }
    let segments = pathSegments(url.pathname).map(normaliseSegment)
    if segments.contains(where: isAmbiguousSegment) { pathKnown = false }
    let path = "/" + segments.joined(separator: "/")
    return .normalized(
        host: host,
        path: path,
        pathKnown: pathKnown,
        surface: pathKnown ? resolveSurface(host: host, path: path, catalog) : nil
    )
}
