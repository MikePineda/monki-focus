// SPDX-License-Identifier: AGPL-3.0-or-later

// The access axis (SEMANTICS.md §5.1, §5.5): `allow`, `friction` and `block`
// candidates compete and the most specific wins (§4). With an unknown path
// the candidates are every rule of the host's domain and profile, each with
// an **effective** mode (a `hide-feed` rule that can cover a feed surface and
// a surface `block` count as `friction`), and the strictest effective mode
// wins, ties by §4. Unknown paths therefore never fail open.

enum AccessMode: Int, Hashable {
    case allow = 0
    case friction = 1
    case block = 2

    var strictness: Int { rawValue }
}

struct AccessCandidate: Hashable {
    let rule: Rule
    let mode: AccessMode
}

/// §5.5: the mode an unknown-path candidate competes with on the access axis, if any.
private func unknownPathMode(_ rule: Rule, host: String, _ catalog: RulesCatalog) -> AccessMode? {
    switch rule.mode {
    case .hideFeed:
        let coversFeed: Bool
        if case .surface(let surface) = rule.target {
            coversFeed = catalog.surfaceKind(surface) == .feed
        } else {
            coversFeed =
                catalog.profileForHost(host)?.surfaces.contains { catalog.surfaceKind($0.surface) == .feed }
                ?? false
        }
        return coversFeed ? .friction : nil
    case .block:
        // Remove the feed, not the tool: a surface block gates; a site block stays a block.
        if case .surface = rule.target { return .friction }
        return .block
    case .friction:
        return .friction
    case .allow:
        return .allow
    }
}

/// Access candidates with their effective modes. `candidates` are the
/// matching rules (known path) or the unknown-path candidates of §5.5.
func accessCandidates(_ candidates: [Rule], _ observation: ResolvedObservation, _ catalog: RulesCatalog)
    -> [AccessCandidate]
{
    if let host = observation.hostOfUnknownPath {
        return candidates.compactMap { rule in
            unknownPathMode(rule, host: host, catalog).map { AccessCandidate(rule: rule, mode: $0) }
        }
    }
    return candidates.compactMap { rule in
        switch rule.mode {
        case .hideFeed: nil
        case .allow: AccessCandidate(rule: rule, mode: .allow)
        case .friction: AccessCandidate(rule: rule, mode: .friction)
        case .block: AccessCandidate(rule: rule, mode: .block)
        }
    }
}

/// The access winner: most specific (§4), after the strictest effective mode on an unknown path.
func accessWinner(_ candidates: [AccessCandidate], unknownPath: Bool, _ catalog: RulesCatalog) -> AccessCandidate? {
    candidates.min { lhs, rhs in
        if unknownPath, lhs.mode != rhs.mode { return lhs.mode.strictness > rhs.mode.strictness }
        return compareRules(lhs.rule, rhs.rule, catalog) < 0
    }
}
