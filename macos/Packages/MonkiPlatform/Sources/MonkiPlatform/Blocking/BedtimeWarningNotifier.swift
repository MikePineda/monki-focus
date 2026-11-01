// SPDX-License-Identifier: AGPL-3.0-or-later

/// Posts the "bedtime soon" notification (`UserNotificationBedtimeWarningNotifier`;
/// tests count the calls).
@MainActor
public protocol BedtimeWarningNotifier: AnyObject {
    func notifyWarning()
}
