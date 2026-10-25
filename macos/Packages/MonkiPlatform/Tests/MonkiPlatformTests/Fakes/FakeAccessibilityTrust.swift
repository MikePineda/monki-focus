// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

final class FakeAccessibilityTrust: AccessibilityTrust {
    var trusted: Bool

    init(trusted: Bool) {
        self.trusted = trusted
    }

    func isTrusted() -> Bool {
        trusted
    }
}
