// SPDX-License-Identifier: AGPL-3.0-or-later

import MonkiCore
import MonkiPlatform
import Testing
import os

@Suite("browser activity inbox")
struct BrowserActivityInboxTests {
    private final class Delivered: Sendable {
        let batches = OSAllocatedUnfairLock(initialState: [[String]]())
    }

    private func heartbeat(_ domain: String) -> BrowserActivityPayload {
        BrowserActivityPayload(
            timestamp: "2026-10-26T00:00:00Z", duration: 0,
            tab: WebTabData(domain: domain, path: "/", surface: nil, audible: false, incognito: false))
    }

    @Test("heartbeats reach the main actor in order, beyond the capacity they are dropped")
    func heartbeatsReachTheMainActorInOrderBeyondTheCapacityTheyAreDropped() async throws {
        let delivered = Delivered()
        let inbox = BrowserActivityInbox(capacity: 3) { [delivered] batch in
            MainActor.assertIsolated()
            delivered.batches.withLock { $0.append(batch.map(\.heartbeat.tab.domain)) }
        }

        let accepted = ["a.example", "b.example", "c.example", "d.example", "e.example"].map {
            inbox.enqueue(heartbeat($0), from: .brave)
        }
        for _ in 0..<100 where delivered.batches.withLock({ $0.isEmpty }) {
            try await Task.sleep(for: .milliseconds(10))
        }

        #expect(accepted == [true, true, true, false, false])
        #expect(inbox.droppedCount == 2)
        #expect(delivered.batches.withLock { $0 } == [["a.example", "b.example", "c.example"]])
    }

    @Test("after a drain the inbox takes heartbeats again")
    func afterADrainTheInboxTakesHeartbeatsAgain() async throws {
        let delivered = Delivered()
        let inbox = BrowserActivityInbox(capacity: 1) { [delivered] batch in
            delivered.batches.withLock { $0.append(batch.map(\.heartbeat.tab.domain)) }
        }

        #expect(inbox.enqueue(heartbeat("a.example"), from: .chrome))
        for _ in 0..<100 where delivered.batches.withLock({ $0.isEmpty }) {
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(inbox.enqueue(heartbeat("b.example"), from: .chrome))
        for _ in 0..<100 where delivered.batches.withLock({ $0.count < 2 }) {
            try await Task.sleep(for: .milliseconds(10))
        }

        #expect(delivered.batches.withLock { $0 } == [["a.example"], ["b.example"]])
    }
}
