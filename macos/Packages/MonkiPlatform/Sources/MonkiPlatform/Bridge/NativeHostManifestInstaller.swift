// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore

/// Writes `dev.monkifocus.bridge.json` into the `NativeMessagingHosts`
/// folder of every supported browser that is installed for this user (its
/// user data folder exists), and removes it again. It never creates a
/// browser's data folder, so a browser the user does not have is left alone.
public struct NativeHostManifestInstaller: Sendable {
    private let home: URL
    private let browsers: [BrowserHostFolder]

    public init(
        home: URL = FileManager.default.homeDirectoryForCurrentUser,
        browsers: [BrowserHostFolder] = BrowserHostFolder.supported
    ) {
        self.home = home
        self.browsers = browsers
    }

    /// The manifest of every installed browser; returns the browsers written.
    @discardableResult
    public func install(_ manifest: NativeHostManifest) throws -> [BrowserHostFolder] {
        let files = FileManager.default
        var written: [BrowserHostFolder] = []
        for browser in browsers where files.fileExists(atPath: url(browser.userDataPath).path) {
            let folder = url(browser.hostsPath)
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            let file = folder.appending(path: NativeHostManifest.fileName, directoryHint: .notDirectory)
            try manifest.encoded().write(to: file, options: .atomic)
            try files.setAttributes([.posixPermissions: 0o644], ofItemAtPath: file.path)
            written.append(browser)
        }
        return written
    }

    /// Removes the manifest wherever it is; returns the browsers it was removed from.
    @discardableResult
    public func uninstall() throws -> [BrowserHostFolder] {
        let files = FileManager.default
        var removed: [BrowserHostFolder] = []
        for browser in browsers {
            let file = url(browser.hostsPath).appending(path: NativeHostManifest.fileName)
            guard files.fileExists(atPath: file.path) else { continue }
            try files.removeItem(at: file)
            removed.append(browser)
        }
        return removed
    }

    /// The browsers that have the manifest now.
    public func installed() -> [BrowserHostFolder] {
        browsers.filter {
            FileManager.default.fileExists(
                atPath: url($0.hostsPath).appending(path: NativeHostManifest.fileName).path)
        }
    }

    private func url(_ relative: String) -> URL {
        home.appending(path: relative, directoryHint: .isDirectory)
    }
}
