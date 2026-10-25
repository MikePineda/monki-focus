// SPDX-License-Identifier: AGPL-3.0-or-later

/// Normalisation of rule targets for validation (uniqueness and domain
/// checks), as `packages/rules/src/TargetNormaliser.ts` does it and
/// SEMANTICS.md §1 and §3.1 describe it. The aliases (alias domain →
/// canonical domain) come from the site profiles, in their order.
struct ValidationTargetNormaliser: Sendable {
    /// Second-level labels that, under a two-letter country TLD, form a public suffix (`co.uk`).
    private static let publicSecondLevelLabels: Set<String> = ["ac", "co", "com", "edu", "gov", "net", "org"]

    let aliases: [(alias: String, canonical: String)]

    /// Drops one leading `www.` or `m.` label, then rewrites an alias suffix to its canonical domain.
    func normaliseDomain(_ domain: String) -> String {
        var host = domain.lowercased()
        if host.hasPrefix("www.") || host.hasPrefix("m."), let dot = host.firstIndex(of: ".") {
            host = String(host[host.index(after: dot)...])
        }
        for (alias, canonical) in aliases {
            if host == alias { return canonical }
            if host.hasSuffix("." + alias) { return String(host.dropLast(alias.count)) + canonical }
        }
        return host
    }

    /// A normalised domain needs two labels and must not be a bare public suffix such as `co.uk`.
    func isRegistrableDomain(_ domain: String) -> Bool {
        let labels = normaliseDomain(domain).split(separator: ".", omittingEmptySubsequences: false)
        guard labels.count >= 2 else { return false }
        let second = String(labels[labels.count - 2])
        let top = labels[labels.count - 1]
        let isPublicSuffix =
            labels.count == 2 && top.count == 2 && Self.publicSecondLevelLabels.contains(second)
        return !isPublicSuffix
    }

    /// The value two targets are compared by for uniqueness: normalised domain,
    /// lower-cased glob and the catch-all glob as no path. Values that are not
    /// site targets are returned unchanged.
    func canonicalTarget(_ value: JSONValue?) -> JSONValue? {
        guard case .object(let target)? = value, target["kind"] == .string("site"),
            case .string(let domain)? = target["domain"]
        else { return value }
        var canonical: [String: JSONValue] = ["kind": .string("site"), "domain": .string(normaliseDomain(domain))]
        if case .string(let path)? = target["path"], path != catchAllGlob {
            canonical["path"] = .string(path.lowercased())
        }
        return .object(canonical)
    }
}
