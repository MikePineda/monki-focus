// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore
import MonkiPlatform
import SwiftUI

/// The bedtime overlay on one screen: a dimming scrim with a neutral
/// "Bedtime" message, the Emergency control and a way to quit monki-focus
/// (leaving is always possible from the device).
struct BedtimeOverlayView: View {
    let emergency: EmergencyStatus
    let actions: any BedtimeOverlayActions

    var body: some View {
        ZStack {
            Color.monkiScrim.ignoresSafeArea()
            VStack(alignment: .leading, spacing: MonkiSpacing.spaceMd) {
                Text("bedtime.title")
                    .font(MonkiTypography.display.font())
                    .foregroundStyle(Color.monkiInk1)
                Text("bedtime.body")
                    .font(MonkiTypography.body.font())
                    .foregroundStyle(Color.monkiInk2)
                    .fixedSize(horizontal: false, vertical: true)
                Divider().overlay(Color.monkiLine)
                EmergencyFooter(status: emergency, request: actions.requestEmergency, cancel: actions.cancelEmergency)
                Button("bedtime.quit") { NSApplication.shared.terminate(nil) }
                    .buttonStyle(.link)
                    .foregroundStyle(Color.monkiInk3)
            }
            .padding(MonkiSpacing.spaceXl)
            .frame(maxWidth: MonkiSpacing.columnMax, alignment: .leading)
            .background(Color.monkiSurface1, in: RoundedRectangle(cornerRadius: MonkiRadius.radiusLg))
        }
    }
}
