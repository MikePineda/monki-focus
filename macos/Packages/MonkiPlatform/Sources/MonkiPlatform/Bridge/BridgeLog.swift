// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import os

/// The bridge log. Privacy: fixed messages, rejection codes and errno values
/// only; never a payload, a URL, a title, a token or a message id.
enum BridgeLog {
    static let logger = Logger(subsystem: "dev.monkifocus.mac", category: "bridge")

    static func event(_ message: StaticString) {
        logger.notice("\(String(describing: message), privacy: .public)")
    }

    static func rejected(_ rejection: BridgeRejection) {
        logger.notice("message rejected: \(rejection.code, privacy: .public)")
    }

    static func failure(_ message: StaticString, errno code: Int32) {
        logger.error("\(String(describing: message), privacy: .public): errno \(code, privacy: .public)")
    }

    static func failure(_ message: StaticString, _ error: any Error) {
        logger.error(
            "\(String(describing: message), privacy: .public): \(String(describing: type(of: error)), privacy: .public)"
        )
    }
}
