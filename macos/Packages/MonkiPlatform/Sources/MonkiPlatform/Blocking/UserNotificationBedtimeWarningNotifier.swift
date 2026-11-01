// SPDX-License-Identifier: AGPL-3.0-or-later

import UserNotifications

/// `BedtimeWarningNotifier` on `UNUserNotificationCenter`. The app passes the
/// already localised title and body (from its string catalog). Permission is
/// asked once; without it nothing is posted and bedtime still works.
@MainActor
public final class UserNotificationBedtimeWarningNotifier: BedtimeWarningNotifier {
    private static let identifier = "dev.monkifocus.mac.bedtime-warning"

    private let title: String
    private let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }

    public func notifyWarning() {
        let title = title
        let body = body
        Task { @MainActor in
            let center = UNUserNotificationCenter.current()
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            let request = UNNotificationRequest(identifier: Self.identifier, content: content, trigger: nil)
            do {
                try await center.add(request)
            } catch {
                BlockingLog.failure("bedtime warning not posted", error)
            }
        }
    }
}
