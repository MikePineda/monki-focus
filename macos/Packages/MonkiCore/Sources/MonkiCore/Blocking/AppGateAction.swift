// SPDX-License-Identifier: AGPL-3.0-or-later

/// What the Mac does with an app that came to the front.
public enum AppGateAction: Hashable, Sendable {
    /// Leave it alone.
    case allow
    /// Hide it and show the intention flow for `group` with the engine's gate.
    case gate(group: String, gate: Gate)
    /// Hide it and show the block panel. Without a group (an engine error)
    /// only closing is offered; with one, the emergency override too.
    case block(group: String?, reason: ReasonCode)
    /// Hide it: bedtime is on and the bedtime overlay offers the emergency override.
    case bedtime
}
