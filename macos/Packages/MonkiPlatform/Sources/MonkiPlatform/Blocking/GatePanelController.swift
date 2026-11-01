// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import SwiftUI

/// `GatePresenter` on one floating `NSPanel`. The app supplies the content
/// (its SwiftUI views use the design tokens and the string catalog); this
/// controller only owns the window. The content always has a Close button, so the
/// user can always dismiss it.
@MainActor
public final class GatePanelController: GatePresenter {
    public typealias Content = @MainActor (GatePanelState, any GatePanelActions) -> AnyView

    private let content: Content
    private var panel: NSPanel?
    private var hosting: NSHostingView<AnyView>?

    public init(content: @escaping Content) {
        self.content = content
    }

    public func show(_ state: GatePanelState, actions: any GatePanelActions) {
        let view = content(state, actions)
        if let hosting {
            hosting.rootView = view
            return
        }
        let hosting = NSHostingView(rootView: view)
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 420),
            styleMask: [.titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.titlebarAppearsTransparent = true
        panel.titleVisibility = .hidden
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.contentView = hosting
        panel.center()
        self.panel = panel
        self.hosting = hosting
        NSApplication.shared.activate()
        panel.makeKeyAndOrderFront(nil)
    }

    public func dismiss() {
        panel?.orderOut(nil)
        panel = nil
        hosting = nil
    }
}
