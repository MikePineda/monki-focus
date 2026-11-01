// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Dims every screen at bedtime (`BedtimeOverlayController`; tests record
/// the calls). `show` is called again on every change of the emergency state.
@MainActor
public protocol BedtimeOverlayPresenter: AnyObject {
    func show(emergency: EmergencyStatus, actions: any BedtimeOverlayActions)
    func hide()
}
