// SPDX-License-Identifier: AGPL-3.0-or-later

import SwiftUI

/// The Settings window. M1 placeholder with the General tab only; the
/// remaining tabs arrive with the UI and onboarding work package.
struct SettingsView: View {
    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    var body: some View {
        TabView {
            Form {
                Text("settings.general.placeholder")
                    .font(MonkiTypography.body.font())
                    .foregroundStyle(Color.monkiInk1)
                Text("settings.general.version \(version)")
                    .font(MonkiTypography.caption.font())
                    .foregroundStyle(Color.monkiInk3)
            }
            .padding(MonkiSpacing.spaceLg)
            .tabItem {
                Label("settings.general.tab", systemImage: "gearshape")
            }
        }
        .frame(width: MonkiSpacing.columnMax)
        .background(Color.monkiSurface0)
    }
}
