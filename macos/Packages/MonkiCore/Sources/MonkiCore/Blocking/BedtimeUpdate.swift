// SPDX-License-Identifier: AGPL-3.0-or-later

/// One step of `BedtimeMonitor`.
public struct BedtimeUpdate: Hashable, Sendable {
    public let notifyWarning: Bool
    public let overlay: BedtimeOverlay

    public init(notifyWarning: Bool, overlay: BedtimeOverlay) {
        self.notifyWarning = notifyWarning
        self.overlay = overlay
    }
}
