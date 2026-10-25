// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// An application that became frontmost, with the process id the
/// Accessibility observer needs.
public struct ActivatedApplication: Hashable, Sendable {
    public var app: ForegroundApp
    public var processIdentifier: Int32

    public init(app: ForegroundApp, processIdentifier: Int32) {
        self.app = app
        self.processIdentifier = processIdentifier
    }
}
