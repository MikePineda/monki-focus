// SPDX-License-Identifier: AGPL-3.0-or-later

import os

/// The capture log. Privacy: it records only fixed messages and error
/// types, never an app, a window title, a URL or any event data.
enum CaptureLog {
    static let logger = Logger(subsystem: "dev.monkifocus.mac", category: "capture")

    static func failure(_ message: StaticString, _ error: any Error) {
        logger.error(
            "\(String(describing: message), privacy: .public): \(String(describing: type(of: error)), privacy: .public)"
        )
    }
}
