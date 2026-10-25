// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

// Up-front checks of `decide`'s inputs (SEMANTICS.md §14): an invalid input
// fails closed whichever path the decision would take, not only when a rule
// happens to read it. Rule sets are schema-validated before they reach the
// engine; this guards what changes at run time: the clock, the observation,
// the escalation and unlock state, and the pinned zones. Lengths count UTF-16
// code units, as the schema validator in the TypeScript engine does.

/// `decision-context.schema.json#/$defs/siteObservation`: `urlText` of 1…2048 characters.
private let maxUrlTextLength = 2048
private let maxAppPackageLength = 255
private let maxSurfaceIdLength = 64

private func isAsciiLetter(_ scalar: Unicode.Scalar) -> Bool {
    ("a"..."z").contains(scalar) || ("A"..."Z").contains(scalar)
}

private func isAsciiDigit(_ scalar: Unicode.Scalar) -> Bool {
    ("0"..."9").contains(scalar)
}

/// `^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_][A-Za-z0-9_-]*)+$` (`target.schema.json#/$defs/appPackage`).
func isAppPackage(_ text: String) -> Bool {
    let labels = text.unicodeScalars.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.count >= 2, let first = labels.first, let head = first.first, isAsciiLetter(head) else {
        return false
    }
    guard first.allSatisfy({ isAsciiLetter($0) || isAsciiDigit($0) || $0 == "_" }) else { return false }
    return labels.dropFirst().allSatisfy { label in
        guard let start = label.first, isAsciiLetter(start) || isAsciiDigit(start) || start == "_" else {
            return false
        }
        return label.allSatisfy { isAsciiLetter($0) || isAsciiDigit($0) || $0 == "_" || $0 == "-" }
    }
}

/// `^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$` (`target.schema.json#/$defs/surfaceId`).
func isSurfaceId(_ text: String) -> Bool {
    let parts = text.unicodeScalars.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 2, let family = parts.first, let name = parts.last,
        let familyHead = family.first, ("a"..."z").contains(familyHead),
        let nameHead = name.first, ("a"..."z").contains(nameHead)
    else { return false }
    let lowerOrDigit = { (scalar: Unicode.Scalar) in ("a"..."z").contains(scalar) || isAsciiDigit(scalar) }
    return family.allSatisfy(lowerOrDigit) && name.allSatisfy { lowerOrDigit($0) || $0 == "_" }
}

/// Observations arrive from adapters at run time, so they are checked against
/// their schema shape (§14): a schema-invalid observation fails closed.
private func checkObservation(_ observation: Observation) throws(EngineError) {
    let valid: Bool
    switch observation {
    case .site(let urlText):
        valid = (1...maxUrlTextLength).contains(urlText.utf16.count)
    case .app(let package, let surface):
        valid =
            package.utf16.count <= maxAppPackageLength && isAppPackage(package)
            && surface.map { $0.utf16.count <= maxSurfaceIdLength && isSurfaceId($0) } ?? true
    }
    guard valid else { throw .invalidObservation }
}

private func checkStateInstants(_ state: DecisionState) throws(EngineError) {
    if let pending = state.pendingEffectiveFrom { _ = try epochSecondsOf(pending) }
    for unlock in state.unlocks {
        _ = try epochSecondsOf(unlock.notBefore)
        _ = try epochSecondsOf(unlock.expiresAt)
    }
    for escalation in state.escalation {
        let instants = [
            escalation.lastAttemptAt, escalation.lastActivityAt, escalation.pauseEndsAt,
            escalation.intentionExpiresAt, escalation.overrideReadyAt, escalation.overrideEndsAt,
        ]
        for case let instant? in instants { _ = try epochSecondsOf(instant) }
    }
}

/// The checks of the inputs every candidate computation reads (the clock, the
/// pinned zones, the observation); returns the instant in epoch seconds and the zones.
func guardCandidateInputs(_ ruleset: Ruleset, _ observation: Observation, at: String) throws(EngineError)
    -> (seconds: Int, zones: [TimeZone])
{
    let seconds = try epochSecondsOf(at)
    let zones = try pinnedZones(of: ruleset)
    try checkObservation(observation)
    return (seconds, zones)
}

/// Throws on the first invalid input; returns `now` in epoch seconds and the zones.
func guardDecisionInputs(_ ruleset: Ruleset, _ observation: Observation, _ state: DecisionState, now: String)
    throws(EngineError) -> (seconds: Int, zones: [TimeZone])
{
    let checked = try guardCandidateInputs(ruleset, observation, at: now)
    try checkStateInstants(state)
    return checked
}
