// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

final class FakeWindowTitleSetting: WindowTitleSetting {
    var titlesEnabled: Bool

    init(titlesEnabled: Bool) {
        self.titlesEnabled = titlesEnabled
    }
}
