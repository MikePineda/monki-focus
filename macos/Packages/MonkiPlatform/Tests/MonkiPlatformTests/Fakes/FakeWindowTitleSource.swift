// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// Window titles the test sets, recording which process is followed.
@MainActor
final class FakeWindowTitleSource: FocusedWindowTitleSource {
    var titles: [Int32: String] = [:]
    private(set) var followed: Int32?
    private(set) var followCount = 0
    private var handler: (@MainActor @Sendable (String?) -> Void)?

    func follow(processIdentifier: Int32, _ handler: @escaping @MainActor @Sendable (String?) -> Void) {
        followed = processIdentifier
        followCount += 1
        self.handler = handler
        handler(titles[processIdentifier])
    }

    func stopFollowing() {
        followed = nil
        handler = nil
    }

    func retitle(_ processIdentifier: Int32, _ title: String?) {
        titles[processIdentifier] = title
        if followed == processIdentifier {
            handler?(title)
        }
    }
}
