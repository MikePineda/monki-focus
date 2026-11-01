// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore

/// Where granted emergency overrides are queued for the guardian
/// (`GRDBBypassOutbox`; tests use a recording fake).
public protocol BypassOutbox: AnyObject {
    func enqueue(_ record: BypassEventRecord, enqueuedAt: String) throws
}
