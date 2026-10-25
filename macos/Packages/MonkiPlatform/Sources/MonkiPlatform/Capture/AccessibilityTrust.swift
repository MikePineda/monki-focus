// SPDX-License-Identifier: AGPL-3.0-or-later

/// Whether the user granted this app Accessibility (`SystemAccessibilityTrust`).
/// Checking never prompts; onboarding (M8) asks.
public protocol AccessibilityTrust {
    func isTrusted() -> Bool
}
