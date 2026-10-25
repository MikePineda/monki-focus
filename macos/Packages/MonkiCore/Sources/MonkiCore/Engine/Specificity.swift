// SPDX-License-Identifier: AGPL-3.0-or-later

// Specificity (SEMANTICS.md §4). Among candidates on one axis the most
// specific wins; the first difference decides: refinement, literal path
// segments, domain labels, wildcards (fewer wins), stricter mode, rule id
// (code-unit ascending). A glob without literal segments counts as no path.

/// Steps 1–4 of §4 for a target (also used for category assignments, §9).
struct TargetSpecificity: Hashable {
    let refinement: Int
    let literals: Int
    let labels: Int
    let wildcards: Int

    init(_ target: Target, _ catalog: RulesCatalog) {
        switch target {
        case .app:
            (refinement, literals, labels, wildcards) = (0, 0, 0, 0)
        case .surface:
            (refinement, literals, labels, wildcards) = (1, 0, 0, 0)
        case .site(let domain, let path):
            let labels = domainLabelCount(catalog.normaliseDomain(domain))
            let shape = globShape(path ?? "/")
            if shape.literals == 0 {
                (refinement, literals, self.labels, wildcards) = (0, 0, labels, 0)
            } else {
                (refinement, literals, self.labels, wildcards) = (1, shape.literals, labels, shape.wildcards)
            }
        }
    }

    /// Negative when `self` is more specific by steps 1–4, positive when less, 0 on a tie.
    func compare(_ other: TargetSpecificity) -> Int {
        if refinement != other.refinement { return other.refinement - refinement }
        if literals != other.literals { return other.literals - literals }
        if labels != other.labels { return other.labels - labels }
        return wildcards - other.wildcards
    }
}

extension RuleMode {
    /// `block > friction > hide-feed > allow` (step 5).
    var strictness: Int {
        switch self {
        case .allow: 0
        case .hideFeed: 1
        case .friction: 2
        case .block: 3
        }
    }
}

/// Full §4 order: negative when rule `lhs` outranks rule `rhs`. Step 5 always
/// uses the rule's own mode, also where §5.5 promotes it to an effective
/// `friction` (`decision.domain_only_youtube_is_not_allowed_by_default`).
func compareRules(_ lhs: Rule, _ rhs: Rule, _ catalog: RulesCatalog) -> Int {
    let targets = TargetSpecificity(lhs.target, catalog).compare(TargetSpecificity(rhs.target, catalog))
    if targets != 0 { return targets }
    if lhs.mode != rhs.mode { return rhs.mode.strictness - lhs.mode.strictness }
    return CodeUnitOrder.compare(lhs.id, rhs.id)
}

/// "R outranks Q".
func outranks(_ rule: Rule, _ other: Rule, _ catalog: RulesCatalog) -> Bool {
    compareRules(rule, other, catalog) < 0
}

/// The most specific rule of a list, or nil for an empty one.
func mostSpecific(_ rules: [Rule], _ catalog: RulesCatalog) -> Rule? {
    rules.reduce(nil) { best, rule in
        guard let best else { return rule }
        return compareRules(rule, best, catalog) < 0 ? rule : best
    }
}
