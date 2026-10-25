// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import Testing

@Suite("window snapshot")
struct WindowSnapshotTests {
    private let editor = ForegroundApp(bundleIdentifier: "org.example.Editor", localizedName: "Editor")

    @Test("titles are recorded only when enabled and Accessibility is granted")
    func titlesAreRecordedOnlyWhenEnabledAndAccessibilityIsGranted() {
        #expect(WindowTitleMode.resolve(titlesEnabled: true, accessibilityTrusted: true) == .appAndTitle)
        #expect(WindowTitleMode.resolve(titlesEnabled: true, accessibilityTrusted: false) == .appOnly)
        #expect(WindowTitleMode.resolve(titlesEnabled: false, accessibilityTrusted: true) == .appOnly)
        #expect(WindowTitleMode.resolve(titlesEnabled: false, accessibilityTrusted: false) == .appOnly)
    }

    @Test("app-only mode drops the title from the event")
    func appOnlyModeDropsTheTitleFromTheEvent() {
        let snapshot = WindowSnapshot(app: editor, title: "Draft notes")

        #expect(snapshot.eventData(mode: .appOnly) == .window(WindowData(app: "org.example.Editor")))
    }

    @Test("title mode keeps a non-empty title")
    func titleModeKeepsANonEmptyTitle() {
        let snapshot = WindowSnapshot(app: editor, title: "Draft notes")

        #expect(
            snapshot.eventData(mode: .appAndTitle)
                == .window(WindowData(app: "org.example.Editor", title: "Draft notes")))
        #expect(
            WindowSnapshot(app: editor, title: "").eventData(mode: .appAndTitle)
                == .window(WindowData(app: "org.example.Editor")))
    }

    @Test("the activity key is the bundle id, else the name, else unidentified")
    func theActivityKeyIsTheBundleIdElseTheNameElseUnidentified() {
        #expect(editor.activityKey == "org.example.Editor")
        #expect(ForegroundApp(bundleIdentifier: nil, localizedName: "Tool").activityKey == "Tool")
        #expect(ForegroundApp(bundleIdentifier: "", localizedName: nil).activityKey == ForegroundApp.unidentifiedKey)
    }

    @Test("mac buckets follow the aw-watcher id convention")
    func macBucketsFollowTheAwWatcherIdConvention() {
        let window = BucketDescriptor.mac(
            .currentWindow, hostname: "test-host", deviceId: "device-a", created: "2026-10-26T00:00:00Z")
        let afk = BucketDescriptor.mac(
            .afkStatus, hostname: "test-host", deviceId: "device-a", created: "2026-10-26T00:00:00Z")

        #expect(window.id == "monki-window_test-host")
        #expect(afk.id == "monki-afk_test-host")
        #expect(window.client == "monki-focus-mac")
    }
}
