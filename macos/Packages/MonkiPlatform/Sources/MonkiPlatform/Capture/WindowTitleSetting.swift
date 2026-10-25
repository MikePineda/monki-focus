// SPDX-License-Identifier: AGPL-3.0-or-later

/// The user's "record window titles" setting (Settings > Privacy, M8). Off by default.
public protocol WindowTitleSetting {
    var titlesEnabled: Bool { get }
}
