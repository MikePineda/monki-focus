// SPDX-License-Identifier: AGPL-3.0-or-later

import os

/// The blocking log. Privacy: fixed messages and error types only, never an
/// app, a bundle id, a rule id, a title, a URL or an intention.
enum BlockingLog {
    static let logger = Logger(subsystem: "dev.monkifocus.mac", category: "blocking")

    static func notice(_ message: StaticString) {
        logger.notice("\(String(describing: message), privacy: .public)")
    }

    static func failure(_ message: StaticString, _ error: any Error) {
        logger.error(
            "\(String(describing: message), privacy: .public): \(String(describing: type(of: error)), privacy: .public)"
        )
    }
}
