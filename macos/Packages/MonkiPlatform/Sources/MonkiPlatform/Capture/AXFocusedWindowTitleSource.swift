// SPDX-License-Identifier: AGPL-3.0-or-later

import ApplicationServices

/// `FocusedWindowTitleSource` on an `AXObserver` for one application:
/// `kAXFocusedWindowChangedNotification` on the application element and
/// `kAXTitleChangedNotification` on its focused window, delivered on the
/// main run loop. Needs Accessibility; without it every read gives nil.
///
/// Privacy: titles go only to the handler, never to a log.
@MainActor
public final class AXFocusedWindowTitleSource: FocusedWindowTitleSource {
    /// How long one Accessibility call may block on an unresponsive app.
    private static let messagingTimeout: Float = 0.25

    private var observer: AXObserver?
    private var application: AXUIElement?
    private var window: AXUIElement?
    private var handler: (@MainActor @Sendable (String?) -> Void)?

    public init() {}

    public func follow(processIdentifier: Int32, _ handler: @escaping @MainActor @Sendable (String?) -> Void) {
        stopFollowing()
        self.handler = handler
        let application = AXUIElementCreateApplication(processIdentifier)
        AXUIElementSetMessagingTimeout(application, Self.messagingTimeout)
        var created: AXObserver?
        guard AXObserverCreate(processIdentifier, Self.callback, &created) == .success, let created else {
            handler(nil)
            return
        }
        self.application = application
        observer = created
        AXObserverAddNotification(created, application, kAXFocusedWindowChangedNotification as CFString, refcon)
        CFRunLoopAddSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(created), .defaultMode)
        focusedWindowChanged()
    }

    public func stopFollowing() {
        if let observer {
            if let application {
                AXObserverRemoveNotification(observer, application, kAXFocusedWindowChangedNotification as CFString)
            }
            if let window {
                AXObserverRemoveNotification(observer, window, kAXTitleChangedNotification as CFString)
            }
            CFRunLoopRemoveSource(CFRunLoopGetMain(), AXObserverGetRunLoopSource(observer), .defaultMode)
        }
        observer = nil
        application = nil
        window = nil
        handler = nil
    }

    /// The observer outlives no follow: `stopFollowing()` removes every
    /// notification before this object could go away (it lives as long as
    /// the capture), so an unretained reference is enough.
    private var refcon: UnsafeMutableRawPointer {
        Unmanaged.passUnretained(self).toOpaque()
    }

    private static let callback: AXObserverCallback = { _, _, notification, refcon in
        guard let refcon else { return }
        let source = Unmanaged<AXFocusedWindowTitleSource>.fromOpaque(refcon).takeUnretainedValue()
        let name = notification as String
        MainActor.assumeIsolated { source.received(name) }
    }

    private func received(_ notification: String) {
        if notification == kAXFocusedWindowChangedNotification {
            focusedWindowChanged()
        } else if notification == kAXTitleChangedNotification {
            handler?(window.flatMap(Self.title))
        }
    }

    private func focusedWindowChanged() {
        guard let observer, let application else { return }
        if let window {
            AXObserverRemoveNotification(observer, window, kAXTitleChangedNotification as CFString)
        }
        window = Self.focusedWindow(of: application)
        if let window {
            AXObserverAddNotification(observer, window, kAXTitleChangedNotification as CFString, refcon)
        }
        handler?(window.flatMap(Self.title))
    }

    private static func focusedWindow(of application: AXUIElement) -> AXUIElement? {
        guard let value = attribute(kAXFocusedWindowAttribute, of: application),
            CFGetTypeID(value) == AXUIElementGetTypeID()
        else { return nil }
        return unsafeDowncast(value, to: AXUIElement.self)
    }

    private static func title(of window: AXUIElement) -> String? {
        attribute(kAXTitleAttribute, of: window) as? String
    }

    private static func attribute(_ name: String, of element: AXUIElement) -> CFTypeRef? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
        return value
    }
}
