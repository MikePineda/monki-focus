// SPDX-License-Identifier: AGPL-3.0-or-later

/// What the gate panel's buttons do (implemented by `AppActivationGate`).
@MainActor
public protocol GatePanelActions: AnyObject {
    /// Leaves the app hidden and closes the panel.
    func close()
    /// Commits an intention of 5, 10 or 15 minutes; false when it is not accepted.
    /// The text stays in memory only, to compare with the next one.
    @discardableResult
    func commit(intention: String, minutes: Int) -> Bool
    func requestEmergency()
    func cancelEmergency()
}
