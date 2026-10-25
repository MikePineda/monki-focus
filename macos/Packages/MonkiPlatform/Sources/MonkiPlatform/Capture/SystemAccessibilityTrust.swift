// SPDX-License-Identifier: AGPL-3.0-or-later

import ApplicationServices

/// `AccessibilityTrust` on `AXIsProcessTrusted()`, which never shows a prompt.
public struct SystemAccessibilityTrust: AccessibilityTrust {
    public init() {}

    public func isTrusted() -> Bool {
        AXIsProcessTrusted()
    }
}
