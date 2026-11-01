// SPDX-License-Identifier: AGPL-3.0-or-later

/// App blocking on the Mac (plan §4.5): when an app is activated or
/// launched the shared engine decides with `target.kind = app` (the bundle
/// id is the package) and this policy turns the decision into an
/// `AppGateAction`. Protected apps are never touched; a granted emergency
/// override of the decision's group lifts it. The escalation group follows
/// the extension's `groupOf`: the rule id, else `bedtime` for a bedtime
/// decision, else none (an engine error).
public struct AppGatePolicy: Hashable, Sendable {
    public let protectedApps: ProtectedApps

    public init(protectedApps: ProtectedApps) {
        self.protectedApps = protectedApps
    }

    /// The observation `decide` reads for an app in front.
    public func observation(for bundleId: String) -> Observation {
        .app(package: bundleId, surface: nil)
    }

    /// The escalation group of a decision, as the extension computes it.
    public static func group(of decision: Decision) -> String? {
        if let ruleId = decision.ruleId { return ruleId }
        return decision.reason == .scheduleBedtime || decision.reason == .emergencyActive ? bedtimeGroup : nil
    }

    /// `decision` is nil only when there is no bundle id to decide on.
    public func action(
        bundleId: String?,
        decision: Decision?,
        overrides: EmergencyOverridePolicy,
        at monotonic: Duration
    ) -> AppGateAction {
        guard let bundleId, let decision, !protectedApps.protects(bundleId) else { return .allow }
        if decision.access == .allow { return .allow }
        let group = Self.group(of: decision)
        if let group, overrides.lifts(group, at: monotonic) { return .allow }
        if decision.reason == .scheduleBedtime { return .bedtime }
        if decision.access == .gate, let group, let gate = decision.gate { return .gate(group: group, gate: gate) }
        return .block(group: group, reason: decision.reason)
    }
}
