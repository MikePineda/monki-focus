// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing

@MainActor
@Suite("window watcher")
struct WindowWatcherTests {
    private typealias E = SampleEvents

    private let activations = FakeApplicationActivationSource(frontmost: SampleApps.editor)
    private let titles = FakeWindowTitleSource()
    private let accessibility: FakeAccessibilityTrust
    private let setting: FakeWindowTitleSetting
    private let recorder = Recorder()

    @MainActor
    final class Recorder {
        var changes: [EventData?] = []
    }

    init() {
        accessibility = FakeAccessibilityTrust(trusted: false)
        setting = FakeWindowTitleSetting(titlesEnabled: false)
        titles.titles = [101: "Draft notes", 102: "Reading list"]
    }

    private func watcher() -> WindowWatcher {
        var watcher: WindowWatcher?
        let made = WindowWatcher(
            activations: activations, titles: titles, accessibility: accessibility, titleSetting: setting
        ) { [recorder] in
            recorder.changes.append(watcher?.eventData)
        }
        watcher = made
        return made
    }

    @Test("it records the frontmost app at start and every activation")
    func itRecordsTheFrontmostAppAtStartAndEveryActivation() {
        let watcher = watcher()

        watcher.start()
        activations.activate(SampleApps.browser)

        #expect(recorder.changes == [E.window(SampleApps.editor), E.window(SampleApps.browser)])
    }

    @Test("without the title setting it records the app only and never touches Accessibility")
    func withoutTheTitleSettingItRecordsTheAppOnlyAndNeverTouchesAccessibility() {
        accessibility.trusted = true
        let watcher = watcher()

        watcher.start()
        activations.activate(SampleApps.browser)

        #expect(recorder.changes == [E.window(SampleApps.editor), E.window(SampleApps.browser)])
        #expect(titles.followCount == 0)
        #expect(watcher.mode == .appOnly)
    }

    @Test("without Accessibility the title setting alone records the app only")
    func withoutAccessibilityTheTitleSettingAloneRecordsTheAppOnly() {
        setting.titlesEnabled = true
        let watcher = watcher()

        watcher.start()

        #expect(recorder.changes == [E.window(SampleApps.editor)])
        #expect(titles.followCount == 0)
    }

    @Test("with the setting and Accessibility it records the focused window title and its changes")
    func withTheSettingAndAccessibilityItRecordsTheFocusedWindowTitleAndItsChanges() {
        setting.titlesEnabled = true
        accessibility.trusted = true
        let watcher = watcher()

        watcher.start()
        titles.retitle(101, "Final notes")
        activations.activate(SampleApps.browser)

        #expect(
            recorder.changes == [
                E.window(SampleApps.editor), E.window(SampleApps.editor, title: "Draft notes"),
                E.window(SampleApps.editor, title: "Final notes"), E.window(SampleApps.browser),
                E.window(SampleApps.browser, title: "Reading list"),
            ])
        #expect(titles.followed == 102)
    }

    @Test("turning titles off stops following and drops the title")
    func turningTitlesOffStopsFollowingAndDropsTheTitle() {
        setting.titlesEnabled = true
        accessibility.trusted = true
        let watcher = watcher()
        watcher.start()

        setting.titlesEnabled = false
        watcher.refreshMode()

        #expect(recorder.changes.last == E.window(SampleApps.editor))
        #expect(titles.followed == nil)
    }

    @Test("suspending ends capture until resume reads the frontmost app again")
    func suspendingEndsCaptureUntilResumeReadsTheFrontmostAppAgain() {
        let watcher = watcher()
        watcher.start()

        watcher.suspend()
        activations.activate(SampleApps.terminal)
        watcher.resume()

        #expect(recorder.changes == [E.window(SampleApps.editor), nil, E.window(SampleApps.terminal)])
    }

    @Test("stopping ends capture and ignores later activations")
    func stoppingEndsCaptureAndIgnoresLaterActivations() {
        let watcher = watcher()
        watcher.start()

        watcher.stop()
        activations.activate(SampleApps.browser)

        #expect(recorder.changes == [E.window(SampleApps.editor), nil])
        #expect(watcher.eventData == nil)
    }
}
