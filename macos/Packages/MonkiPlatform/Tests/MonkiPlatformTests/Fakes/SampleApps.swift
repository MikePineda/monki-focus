// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// Synthetic apps.
enum SampleApps {
    static let editor = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "org.example.Editor", localizedName: "Editor"), processIdentifier: 101)
    static let browser = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "org.example.Browser", localizedName: "Browser"), processIdentifier: 102)
    static let terminal = ActivatedApplication(
        app: ForegroundApp(bundleIdentifier: "org.example.Terminal", localizedName: "Terminal"),
        processIdentifier: 103)
}
