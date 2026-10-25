// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiPlatform
import Testing

@Suite("native host manifest installer")
final class NativeHostManifestInstallerTests {
    private let home = FileManager.default.temporaryDirectory
        .appending(path: "mf-home-\(UUID().uuidString)", directoryHint: .isDirectory)
    private let id = String(repeating: "c", count: 32)

    deinit {
        try? FileManager.default.removeItem(at: home)
    }

    private func makeBrowser(_ folder: BrowserHostFolder) throws {
        try FileManager.default.createDirectory(
            at: home.appending(path: folder.userDataPath), withIntermediateDirectories: true)
    }

    private func manifestURL(_ folder: BrowserHostFolder) -> URL {
        home.appending(path: folder.hostsPath).appending(path: "dev.monkifocus.bridge.json")
    }

    @Test("the manifest goes only to the browsers the user has")
    func theManifestGoesOnlyToTheBrowsersTheUserHas() throws {
        try makeBrowser(.brave)
        let manifest = try NativeHostManifest(
            helperPath: "/Applications/MonkiFocus.app/Contents/Helpers/monki-bridge", extensionIds: [id])

        let written = try NativeHostManifestInstaller(home: home).install(manifest)

        #expect(written == [.brave])
        #expect(try Data(contentsOf: manifestURL(.brave)) == manifest.encoded())
        #expect(
            !FileManager.default.fileExists(atPath: home.appending(path: BrowserHostFolder.chrome.userDataPath).path))
        let mode = try FileManager.default.attributesOfItem(atPath: manifestURL(.brave).path)[.posixPermissions]
        #expect(mode as? Int == 0o644)
    }

    @Test("installing again replaces the manifest and uninstalling removes it everywhere")
    func installingAgainReplacesTheManifestAndUninstallingRemovesItEverywhere() throws {
        try makeBrowser(.brave)
        try makeBrowser(.chrome)
        let installer = NativeHostManifestInstaller(home: home)
        try installer.install(try NativeHostManifest(helperPath: "/old/monki-bridge", extensionIds: [id]))
        let current = try NativeHostManifest(helperPath: "/new/monki-bridge", extensionIds: [id])

        try installer.install(current)
        #expect(try Data(contentsOf: manifestURL(.chrome)) == current.encoded())
        #expect(installer.installed() == [.brave, .chrome])

        #expect(try installer.uninstall() == [.brave, .chrome])
        #expect(installer.installed().isEmpty)
    }

    @Test("the per-browser folders are Brave's and Chrome's user data folders")
    func thePerBrowserFoldersAreBravesAndChromesUserDataFolders() {
        #expect(
            BrowserHostFolder.brave.hostsPath
                == "Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts")
        #expect(BrowserHostFolder.chrome.hostsPath == "Library/Application Support/Google/Chrome/NativeMessagingHosts")
    }
}
