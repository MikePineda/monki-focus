// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// App blocking (plan §4.5): on every activation or launch the shared engine
/// decides with `target.kind = app` and `AppGatePolicy` picks the action.
///
/// - `gate`: the app is hidden and the panel runs the intention flow of the
///   extension (visit → pause → intention and 5/10/15 minutes). A committed
///   intention brings the app back until it expires.
/// - `block`: the app is hidden and the panel offers closing and, when the
///   decision has a group, the emergency override.
/// - `bedtime`: the app is hidden; the bedtime overlay takes over.
///
/// It never quits an app. Every second it advances the overrides, the pause
/// and checks the frontmost app again (an expired intention, bedtime
/// starting). Nothing about the app is logged or stored.
@MainActor
public final class AppActivationGate: GatePanelActions {
    public struct Dependencies {
        public var sources: [any ApplicationActivationSource]
        public var control: any ApplicationControl
        public var presenter: any GatePresenter
        public var rules: any RulesProvider
        public var overrides: EmergencyOverrides
        public var escalation: EscalationBook
        public var timers: any RepeatingTimerScheduler
        public var wall: any MonkiCore.Clock
        public var policy: AppGatePolicy

        public init(
            sources: [any ApplicationActivationSource],
            control: any ApplicationControl,
            presenter: any GatePresenter,
            rules: any RulesProvider,
            overrides: EmergencyOverrides,
            escalation: EscalationBook,
            timers: any RepeatingTimerScheduler,
            wall: any MonkiCore.Clock,
            policy: AppGatePolicy
        ) {
            self.sources = sources
            self.control = control
            self.presenter = presenter
            self.rules = rules
            self.overrides = overrides
            self.escalation = escalation
            self.timers = timers
            self.wall = wall
            self.policy = policy
        }
    }

    /// The app the panel is about.
    private struct Hidden {
        let application: ActivatedApplication
        let group: String?
        /// Nil for a gate; the reason for a block.
        let blockReason: ReasonCode?
    }

    private static let intentionMinutes: Set<Int> = [5, 10, 15]

    private let dependencies: Dependencies
    private var hidden: Hidden?
    private var timer: (any RepeatingTimer)?
    /// The last committed intention per group, in memory only (§7.5 "differs from the previous").
    private var previousIntention: [String: String] = [:]

    public init(_ dependencies: Dependencies) {
        self.dependencies = dependencies
    }

    public func start() {
        for source in dependencies.sources {
            source.start { [weak self] application in self?.handle(application) }
        }
        timer = dependencies.timers.schedule(every: .seconds(1)) { [weak self] in self?.tick() }
        if let frontmost = dependencies.sources.lazy.compactMap(\.frontmostApplication).first {
            handle(frontmost)
        }
    }

    public func stop() {
        dependencies.sources.forEach { $0.stop() }
        timer?.cancel()
        timer = nil
        dependencies.presenter.dismiss()
        hidden = nil
    }

    // MARK: Decisions

    private var nowInstant: String { utcInstantOf(WallSeconds.of(dependencies.wall)) }

    private func action(for application: ActivatedApplication) -> AppGateAction {
        guard let bundleId = application.app.bundleIdentifier, let snapshot = dependencies.rules.current else {
            return .allow
        }
        let policy = dependencies.policy
        let decision = decide(
            snapshot.ruleset,
            observation: policy.observation(for: bundleId),
            state: DecisionState(escalation: dependencies.escalation.all),
            now: nowInstant,
            catalog: snapshot.catalog
        )
        return policy.action(
            bundleId: bundleId, decision: decision, overrides: dependencies.overrides.policy,
            at: dependencies.overrides.now)
    }

    func handle(_ application: ActivatedApplication) {
        // The panel itself brings monki-focus forward; that never changes anything.
        if let bundleId = application.app.bundleIdentifier, dependencies.policy.protectedApps.protects(bundleId) {
            return
        }
        switch action(for: application) {
        case .allow:
            return
        case .gate(let group, _):
            dependencies.control.hide(processIdentifier: application.processIdentifier)
            if hidden?.group != group || hidden?.blockReason != nil {
                // A new attempt; reopening the same group never restarts its pause (§7.3).
                dependencies.escalation.apply(.visit, to: group, now: nowInstant)
            }
            hidden = Hidden(application: application, group: group, blockReason: nil)
            render()
        case .block(let group, let reason):
            dependencies.control.hide(processIdentifier: application.processIdentifier)
            hidden = Hidden(application: application, group: group, blockReason: reason)
            render()
        case .bedtime:
            dependencies.control.hide(processIdentifier: application.processIdentifier)
            dismissPanel()
        }
    }

    /// Once a second: grants, the pause, an override that lifted the panel, the frontmost app.
    func tick() {
        dependencies.overrides.advance()
        if let hidden, let group = hidden.group {
            if dependencies.overrides.lifts(group) {
                release(hidden)
                return
            }
            let state = dependencies.escalation.state(of: group)
            if hidden.blockReason == nil, state.phase == .pausing, pauseRemaining(state) == 0 {
                dependencies.escalation.apply(.pauseElapsed, to: group, now: nowInstant)
            }
        }
        if hidden != nil { render() }
        // The app the panel is about was hidden already; an activation would bring it here again.
        if let frontmost = dependencies.sources.lazy.compactMap(\.frontmostApplication).first,
            frontmost.processIdentifier != hidden?.application.processIdentifier
        {
            handle(frontmost)
        }
    }

    private func pauseRemaining(_ state: EscalationState) -> Int {
        guard let endsAt = state.pauseEndsAt, let end = try? epochSecondsOf(endsAt) else { return 0 }
        return max(0, end - WallSeconds.of(dependencies.wall))
    }

    // MARK: Panel

    private func render() {
        guard let hidden else { return }
        let mode: GatePanelState.Mode
        var level: Int?
        if let reason = hidden.blockReason {
            mode = .blocked(reason: reason)
        } else if let group = hidden.group {
            let state = dependencies.escalation.state(of: group)
            level = state.gate?.level
            if state.phase == .asking, let gate = state.gate {
                mode = .asking(requirements: intentionRequirements(gate))
            } else {
                mode = .pausing(remainingSeconds: pauseRemaining(state), totalSeconds: state.gate?.pauseSeconds ?? 0)
            }
        } else {
            mode = .blocked(reason: .engineError)
        }
        let emergency = hidden.group.map { dependencies.overrides.status(of: $0) } ?? .none
        dependencies.presenter.show(
            GatePanelState(
                appName: hidden.application.app.localizedName,
                mode: mode,
                level: level,
                emergencyAvailable: hidden.group != nil,
                emergency: emergency
            ),
            actions: self
        )
    }

    private func dismissPanel() {
        guard hidden != nil else { return }
        hidden = nil
        dependencies.presenter.dismiss()
    }

    /// Brings the app back: an intention was committed or an override granted.
    private func release(_ hidden: Hidden) {
        dismissPanel()
        dependencies.control.activate(processIdentifier: hidden.application.processIdentifier)
    }

    // MARK: GatePanelActions

    public func close() {
        if let group = hidden?.group {
            if hidden?.blockReason == nil {
                dependencies.escalation.apply(.close, to: group, now: nowInstant)
            }
            dependencies.overrides.cancel(group)
        }
        dismissPanel()
    }

    @discardableResult
    public func commit(intention: String, minutes: Int) -> Bool {
        guard let hidden, hidden.blockReason == nil, let group = hidden.group, Self.intentionMinutes.contains(minutes)
        else { return false }
        let state = dependencies.escalation.state(of: group)
        guard state.phase == .asking, let gate = state.gate else { return false }
        if gate.requiresTypedIntention,
            !isIntentionAcceptable(intention, previous: previousIntention[group], gate: gate)
        {
            return false
        }
        let next = dependencies.escalation.apply(
            .commit(minutes: minutes, typedWords: intentionWordCount(intention), guardianKeyVerified: false),
            to: group, now: nowInstant)
        guard next.phase == .active else { return false }
        if intentionWordCount(intention) > 0 { previousIntention[group] = intention }
        release(hidden)
        return true
    }

    public func requestEmergency() {
        guard let group = hidden?.group else { return }
        dependencies.overrides.request(group)
        render()
    }

    public func cancelEmergency() {
        guard let group = hidden?.group else { return }
        dependencies.overrides.cancel(group)
        render()
    }
}
