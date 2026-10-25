// SPDX-License-Identifier: AGPL-3.0-or-later

// The content axis (SEMANTICS.md §5.3): `hide-feed` and `allow` candidates
// compete (an allow rule speaks for both axes) and the most specific wins.
// A `hide-feed` winner hides only a resolved `feed` surface; a permalink or a
// utility surface, an unmapped path and an unknown path are always shown.

struct ContentOutcome: Hashable {
    let content: Content
    /// The content winner, or nil when no rule competes on this axis.
    let winner: Rule?
    let reason: ReasonCode
}

private func hideFeedOutcome(_ winner: Rule, _ observation: ResolvedObservation, _ catalog: RulesCatalog)
    -> ContentOutcome
{
    if observation.hasUnknownPath {
        return ContentOutcome(content: .show, winner: winner, reason: .pathUnknownAllow)
    }
    switch observation.surface.flatMap(catalog.surfaceKind) {
    case .feed:
        return ContentOutcome(content: .hideFeed, winner: winner, reason: .ruleMatch)
    case nil:
        return ContentOutcome(content: .show, winner: winner, reason: .notAFeed)
    case .permalink, .utility:
        return ContentOutcome(content: .show, winner: winner, reason: .permalinkNeverHidden)
    }
}

/// `matching` are the enabled, scheduled rules whose target matches the observation.
func contentOutcome(_ matching: [Rule], _ observation: ResolvedObservation, _ catalog: RulesCatalog)
    -> ContentOutcome
{
    let winner = mostSpecific(matching.filter { $0.mode == .hideFeed || $0.mode == .allow }, catalog)
    guard let winner, winner.mode == .hideFeed else {
        return ContentOutcome(content: .show, winner: winner, reason: .ruleMatch)
    }
    return hideFeedOutcome(winner, observation, catalog)
}
