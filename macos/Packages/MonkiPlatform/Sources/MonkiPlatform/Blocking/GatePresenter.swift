// SPDX-License-Identifier: AGPL-3.0-or-later

/// Shows the gate panel (`GatePanelController`; tests record the calls).
/// `show` is called again on every change, so the panel always shows the
/// latest state.
@MainActor
public protocol GatePresenter: AnyObject {
    func show(_ state: GatePanelState, actions: any GatePanelActions)
    func dismiss()
}
