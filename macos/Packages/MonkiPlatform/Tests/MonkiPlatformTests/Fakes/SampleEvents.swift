// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform

/// Event builders relative to `FakeTime.origin`.
enum SampleEvents {
    static func window(_ app: ActivatedApplication, title: String? = nil) -> EventData {
        .window(WindowData(app: app.app.activityKey, title: title))
    }

    static func event(_ offset: Int, _ duration: Int, _ data: EventData) -> ActivityEvent {
        ActivityEvent(timestamp: utcInstantOf(FakeTime.origin + offset), duration: duration, data: data)
    }

    static func bucket(_ type: ActivityWatchBucketType) -> BucketDescriptor {
        .mac(type, hostname: "test-host", deviceId: "device-a", created: utcInstantOf(FakeTime.origin))
    }
}
