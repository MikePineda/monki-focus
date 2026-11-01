// SPDX-License-Identifier: AGPL-3.0-or-later

import AppKit
import MonkiCore
import SwiftUI

/// `BedtimeOverlayPresenter` with one borderless window per `NSScreen` at
/// screen-saver level, recreated whenever the screens change. The app
/// supplies the content (neutral copy, the Emergency button and a way to
/// quit monki-focus: leaving is always possible from the device).
@MainActor
public final class BedtimeOverlayController: BedtimeOverlayPresenter {
    public typealias Content = @MainActor (EmergencyStatus, any BedtimeOverlayActions) -> AnyView

    private let content: Content
    private var windows: [NSWindow] = []
    private var hostings: [NSHostingView<AnyView>] = []
    private var screensObserver: (any NSObjectProtocol)?
    private var last: (EmergencyStatus, any BedtimeOverlayActions)?

    public init(content: @escaping Content) {
        self.content = content
    }

    public func show(emergency: EmergencyStatus, actions: any BedtimeOverlayActions) {
        last = (emergency, actions)
        if windows.isEmpty {
            build()
            observeScreens()
            NSApplication.shared.activate()
        } else {
            for hosting in hostings { hosting.rootView = content(emergency, actions) }
        }
    }

    public func hide() {
        last = nil
        tearDown()
        if let screensObserver { NotificationCenter.default.removeObserver(screensObserver) }
        screensObserver = nil
    }

    private func build() {
        guard let (emergency, actions) = last else { return }
        for (index, screen) in NSScreen.screens.enumerated() {
            let window = NSWindow(
                contentRect: screen.frame, styleMask: [.borderless], backing: .buffered, defer: false, screen: screen)
            window.level = .screenSaver
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
            window.isReleasedWhenClosed = false
            window.isOpaque = false
            window.backgroundColor = .clear
            let hosting = NSHostingView(rootView: content(emergency, actions))
            window.contentView = hosting
            window.setFrame(screen.frame, display: true)
            // The main screen's window takes the keyboard, for the buttons and Command-Q.
            if index == 0 { window.makeKeyAndOrderFront(nil) } else { window.orderFrontRegardless() }
            windows.append(window)
            hostings.append(hosting)
        }
    }

    private func tearDown() {
        windows.forEach { $0.orderOut(nil) }
        windows = []
        hostings = []
    }

    private func observeScreens() {
        guard screensObserver == nil else { return }
        screensObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.last != nil else { return }
                self.tearDown()
                self.build()
            }
        }
    }
}
