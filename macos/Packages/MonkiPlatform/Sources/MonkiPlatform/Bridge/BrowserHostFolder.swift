// SPDX-License-Identifier: AGPL-3.0-or-later

/// A browser whose user-level `NativeMessagingHosts` folder receives the
/// bridge manifest.
///
/// Chromium reads user-level host manifests from
/// `<user data dir>/NativeMessagingHosts` on macOS (`DIR_USER_NATIVE_MESSAGING`
/// in chrome/common/chrome_paths.cc), and the user data dir is
/// `~/Library/Application Support/<CrProductDirName>` (chrome_paths_mac.mm).
/// - Chrome: `Google/Chrome`, documented at
///   https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging#native-messaging-host-location
/// - Brave: `BraveSoftware/Brave-Browser`, the `CrProductDirName` in
///   `Brave Browser.app/Contents/Info.plist` (checked on Brave 1.97.57,
///   Chromium 155). Older Brave releases read Chrome's folder instead
///   (https://github.com/brave/brave-browser/issues/5074), which the Chrome
///   entry covers when Chrome is installed too.
public struct BrowserHostFolder: Hashable, Sendable {
    public var name: String
    /// The browser's user data folder, relative to the home folder.
    public var userDataPath: String

    public init(name: String, userDataPath: String) {
        self.name = name
        self.userDataPath = userDataPath
    }

    /// `<user data dir>/NativeMessagingHosts`, relative to the home folder.
    public var hostsPath: String {
        "\(userDataPath)/NativeMessagingHosts"
    }

    public static let brave = BrowserHostFolder(
        name: "brave", userDataPath: "Library/Application Support/BraveSoftware/Brave-Browser")
    public static let chrome = BrowserHostFolder(
        name: "chrome", userDataPath: "Library/Application Support/Google/Chrome")

    public static let supported = [brave, chrome]
}
