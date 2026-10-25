// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// App activations sent by the test.
@MainActor
final class FakeApplicationActivationSource: ApplicationActivationSource {
    var frontmostApplication: ActivatedApplication?
    private var handler: (@MainActor @Sendable (ActivatedApplication) -> Void)?

    init(frontmost: ActivatedApplication? = nil) {
        frontmostApplication = frontmost
    }

    func start(_ handler: @escaping @MainActor @Sendable (ActivatedApplication) -> Void) {
        self.handler = handler
    }

    func stop() {
        handler = nil
    }

    func activate(_ application: ActivatedApplication) {
        frontmostApplication = application
        handler?(application)
    }
}
