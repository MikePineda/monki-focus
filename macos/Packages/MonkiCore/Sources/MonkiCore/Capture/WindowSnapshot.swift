// SPDX-License-Identifier: AGPL-3.0-or-later

/// The frontmost app and, when read, its focused window title.
public struct WindowSnapshot: Hashable, Sendable {
    public var app: ForegroundApp
    public var title: String?

    public init(app: ForegroundApp, title: String? = nil) {
        self.app = app
        self.title = title
    }

    /// The `currentwindow` event data. The title is kept only in
    /// `.appAndTitle` mode and only when it is not empty.
    public func eventData(mode: WindowTitleMode) -> EventData {
        let keptTitle = mode == .appAndTitle ? title.flatMap { $0.isEmpty ? nil : $0 } : nil
        return .window(WindowData(app: app.activityKey, title: keptTitle))
    }
}
