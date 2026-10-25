// SPDX-License-Identifier: AGPL-3.0-or-later

// Path globs (SEMANTICS.md §3.2): `/`, or `/`-separated segments that are a
// literal, `*` (exactly one segment) or a final `**` (zero or more segments).
// Literals compare ASCII case-insensitively. The schema rejects partial
// wildcards and `%` escapes, so a glob means exactly what it says.

/// `/**` matches every path, also an unknown one.
let catchAllGlob = "/**"

/// Literal segments and wildcards (`*` and `**` count 1 each) of a glob.
struct GlobShape: Hashable {
    let literals: Int
    let wildcards: Int
}

func pathSegments(_ path: String) -> [Substring] {
    path.split(separator: "/", omittingEmptySubsequences: true)
}

/// ASCII-only lower-casing, as `PathGlob.ts` does it (`[A-Z]` only).
func asciiLowercased<S: StringProtocol>(_ text: S) -> String {
    String(
        String.UnicodeScalarView(
            text.unicodeScalars.map { scalar in
                ("A"..."Z").contains(scalar) ? Unicode.Scalar(scalar.value + 32) ?? scalar : scalar
            }
        )
    )
}

private func matchSegments(_ glob: ArraySlice<Substring>, _ path: ArraySlice<Substring>) -> Bool {
    guard let head = glob.first else { return path.isEmpty }
    if head == "**" { return true }
    guard let segment = path.first else { return false }
    if head != "*", asciiLowercased(head) != asciiLowercased(segment) { return false }
    return matchSegments(glob.dropFirst(), path.dropFirst())
}

/// Whether a normalised path (`/`, `/a/b`) matches the glob.
func matchesGlob(_ glob: String, _ path: String) -> Bool {
    matchSegments(ArraySlice(pathSegments(glob)), ArraySlice(pathSegments(path)))
}

func globShape(_ glob: String) -> GlobShape {
    let segments = pathSegments(glob)
    let wildcards = segments.filter { $0 == "*" || $0 == "**" }.count
    return GlobShape(literals: segments.count - wildcards, wildcards: wildcards)
}
