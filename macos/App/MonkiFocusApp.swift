// SPDX-License-Identifier: AGPL-3.0-or-later

import SwiftUI

/// The menu-bar app: no Dock icon (`LSUIElement`), always a visible status
/// item. There is no hidden mode; quitting is one click away in the panel.
@main
struct MonkiFocusApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra("menubar.title", systemImage: "leaf") {
            TodayPanel()
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsView()
        }
    }
}
