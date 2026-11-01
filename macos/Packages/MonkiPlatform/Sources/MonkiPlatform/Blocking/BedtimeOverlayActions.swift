// SPDX-License-Identifier: AGPL-3.0-or-later

/// What the bedtime overlay's buttons do (implemented by `BedtimeCoordinator`).
@MainActor
public protocol BedtimeOverlayActions: AnyObject {
    func requestEmergency()
    func cancelEmergency()
}
