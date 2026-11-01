// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import SwiftUI

/// The gate panel for a hidden app (plan §8.1, as in the extension): the
/// pause, then the intention and its minutes; or the block screen. "Close"
/// is the primary action from the first second; the emergency override is a
/// quiet footer. Neutral copy, design tokens only.
struct GatePanelView: View {
    let state: GatePanelState
    let actions: any GatePanelActions

    @State private var intention = ""
    @State private var minutes: Int?
    @State private var rejected = false

    var body: some View {
        VStack(alignment: .leading, spacing: MonkiSpacing.spaceMd) {
            if let name = state.appName {
                Text("gate.app.hidden \(name)")
                    .font(MonkiTypography.label.font())
                    .foregroundStyle(Color.monkiInk3)
            }
            content
            Button(action: actions.close) {
                Text("gate.close").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.monkiAccent)
            .controlSize(.large)
            .keyboardShortcut(.cancelAction)
            if let level = state.level {
                Text("gate.level \(level)")
                    .font(MonkiTypography.label.font())
                    .foregroundStyle(Color.monkiInk3)
            }
            if state.emergencyAvailable {
                Divider().overlay(Color.monkiLine)
                EmergencyFooter(
                    status: state.emergency, request: actions.requestEmergency, cancel: actions.cancelEmergency)
            }
        }
        .padding(MonkiSpacing.spaceLg)
        .frame(width: 480, alignment: .leading)
        .background(Color.monkiSurface0)
    }

    @ViewBuilder private var content: some View {
        switch state.mode {
        case .pausing(let remaining, _):
            Text("gate.pause.title")
                .font(MonkiTypography.title.font())
                .foregroundStyle(Color.monkiInk1)
            Text(verbatim: "\(remaining)")
                .font(MonkiTypography.countdown.font())
                .foregroundStyle(Color.monkiInk1)
                .accessibilityLabel(Text("gate.pause.seconds \(remaining)"))
        case .asking(let requirements):
            asking(requirements)
        case .blocked(let reason):
            Text("gate.blocked.title")
                .font(MonkiTypography.title.font())
                .foregroundStyle(Color.monkiInk1)
            Text(reason == .engineError ? LocalizedStringKey("gate.blocked.engine_error") : "gate.blocked.body")
                .font(MonkiTypography.body.font())
                .foregroundStyle(Color.monkiInk2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder private func asking(_ requirements: IntentionRequirements) -> some View {
        Text("gate.intention.question")
            .font(MonkiTypography.title.font())
            .foregroundStyle(Color.monkiInk1)
        TextField("gate.intention.placeholder", text: $intention)
            .textFieldStyle(.roundedBorder)
            .font(MonkiTypography.body.font())
        if requirements.minWords > 0 {
            Text("gate.intention.words \(requirements.minWords)")
                .font(MonkiTypography.bodySm.font())
                .foregroundStyle(rejected ? Color.monkiInk1 : Color.monkiInk3)
        }
        Text("gate.minutes.label")
            .font(MonkiTypography.label.font())
            .foregroundStyle(Color.monkiInk2)
        Picker("gate.minutes.label", selection: $minutes) {
            ForEach([5, 10, 15], id: \.self) { option in
                Text("gate.minutes.option \(option)").tag(Optional(option))
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        Button("gate.continue") {
            guard let minutes else { return }
            rejected = !actions.commit(intention: intention, minutes: minutes)
        }
        .buttonStyle(.link)
        .foregroundStyle(Color.monkiInk2)
        .disabled(minutes == nil)
    }
}
