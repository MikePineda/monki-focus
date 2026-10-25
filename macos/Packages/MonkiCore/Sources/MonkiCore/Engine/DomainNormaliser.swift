// SPDX-License-Identifier: AGPL-3.0-or-later

// Host and domain normalisation (SEMANTICS.md §2 steps 5–6, §3.1): lower-case,
// drop one trailing `.`, drop one leading `www.` or `m.` label, then rewrite a
// site-profile alias suffix to its canonical domain (`mobile.twitter.com` →
// `mobile.x.com`). Rule, category and unlock domains go through the same
// steps, so a rule on `twitter.com` acts on `x.com`.

/// Alias domain → canonical domain, longest alias first so the most specific suffix wins.
struct AliasTable: Hashable, Sendable {
    let entries: [(alias: String, canonical: String)]

    init(_ aliases: [String: String]) {
        entries = aliases.map { (alias: $0.key, canonical: $0.value) }
            .sorted { lhs, rhs in
                let lhsLength = lhs.alias.utf16.count
                let rhsLength = rhs.alias.utf16.count
                return lhsLength != rhsLength ? lhsLength > rhsLength : CodeUnitOrder.less(lhs.alias, rhs.alias)
            }
    }

    static func == (lhs: AliasTable, rhs: AliasTable) -> Bool {
        lhs.entries.elementsEqual(rhs.entries) { $0.alias == $1.alias && $0.canonical == $1.canonical }
    }

    func hash(into hasher: inout Hasher) {
        for entry in entries {
            hasher.combine(entry.alias)
            hasher.combine(entry.canonical)
        }
    }
}

/// Steps 5 (without validation) and 6 for an ASCII host or a rule domain.
func normaliseDomain(_ domain: String, aliases: AliasTable) -> String {
    var host = domain.lowercased()
    if host.hasSuffix(".") { host.removeLast() }
    if host.hasPrefix("www.") || host.hasPrefix("m."), let dot = host.firstIndex(of: ".") {
        host = String(host[host.index(after: dot)...])
    }
    for (alias, canonical) in aliases.entries {
        if host == alias { return canonical }
        if host.hasSuffix("." + alias) { return String(host.dropLast(alias.count)) + canonical }
    }
    return host
}

/// `host` equals `domain` or is one of its subdomains.
func isDomainOrSubdomain(_ host: String, _ domain: String) -> Bool {
    host == domain || host.hasSuffix("." + domain)
}

func domainLabelCount(_ domain: String) -> Int {
    domain.split(separator: ".", omittingEmptySubsequences: false).count
}
