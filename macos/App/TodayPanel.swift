// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import SwiftUI

/// The "Today" panel shown from the menu-bar icon. M1 placeholder: the Pulse,
/// level bar and top apps arrive with the analytics and UI work packages.
struct TodayPanel: View {
    @Environment(\.openSettings) private var openSettings

    var body: some View {
        VStack(alignment: .leading, spacing: MonkiSpacing.spaceMd) {
            Text("today.title")
                .font(MonkiTypography.heading.font())
                .foregroundStyle(Color.monkiInk1)

            VStack(alignment: .leading, spacing: MonkiSpacing.spaceXs) {
                Text("today.pulse.label")
                    .font(MonkiTypography.label.font())
                    .foregroundStyle(Color.monkiInk2)
                Text("today.pulse.none")
                    .font(MonkiTypography.stat.font())
                    .foregroundStyle(Color.monkiInk1)
            }

            Text("today.empty")
                .font(MonkiTypography.bodySm.font())
                .foregroundStyle(Color.monkiInk3)
                .fixedSize(horizontal: false, vertical: true)

            Divider().overlay(Color.monkiLine)

            HStack {
                Button("today.settings") {
                    // A menu-bar app is never frontmost on its own; bring the window forward.
                    NSApplication.shared.activate()
                    openSettings()
                }
                Spacer()
                Button("today.quit") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
            .buttonStyle(.borderless)
            .font(MonkiTypography.bodySm.font())
            .foregroundStyle(Color.monkiInk2)
        }
        .padding(MonkiSpacing.spaceMd)
        .frame(width: MonkiSpacing.panelWidth, alignment: .leading)
        .background(Color.monkiSurface1)
    }
}
