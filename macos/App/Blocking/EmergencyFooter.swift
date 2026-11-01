// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import SwiftUI

/// The quiet emergency override control shared by the gate panel and the
/// bedtime overlay: request, then a 2-minute countdown that can be cancelled.
struct EmergencyFooter: View {
    let status: EmergencyStatus
    let request: () -> Void
    let cancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: MonkiSpacing.spaceXs) {
            switch status {
            case .waiting(let remaining):
                Text("emergency.waiting \(Int(remaining.components.seconds))")
                    .font(MonkiTypography.numeric.font())
                    .foregroundStyle(Color.monkiInk2)
                Text("emergency.recorded")
                    .font(MonkiTypography.bodySm.font())
                    .foregroundStyle(Color.monkiInk3)
                Button("emergency.cancel", action: cancel)
                    .buttonStyle(.link)
                    .foregroundStyle(Color.monkiInk2)
            case .active:
                Text("emergency.active")
                    .font(MonkiTypography.bodySm.font())
                    .foregroundStyle(Color.monkiInk2)
            case .none:
                Button("emergency.request", action: request)
                    .buttonStyle(.link)
                    .foregroundStyle(Color.monkiInk3)
            }
        }
    }
}
