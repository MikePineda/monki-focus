// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Dispatch
import Foundation
import MonkiCore
import os

/// One accepted `monki-bridge` connection: NDJSON in, NDJSON out, on its own
/// serial queue. Every line is validated as a message from the extension.
/// The connection closes, without affecting any other, on the first
/// malformed or oversized line, a write that times out, the peer hanging up,
/// no valid `hello` within the hello timeout, or silence past the idle
/// timeout. Lines over the rate limit are dropped.
final class BridgeConnection: @unchecked Sendable {
    /// Accept order, so the server can evict the oldest connection that never said hello.
    let sequence: UInt64
    // State below is only touched on `queue`, except `greeted` (locked).
    private let socket: Int32
    private let queue: DispatchQueue
    private let handler: any BridgeMessageHandler
    private let limits: BridgeConnectionLimits
    private let onClose: @Sendable (BridgeConnection) -> Void
    private let greetedFlag = OSAllocatedUnfairLock(initialState: false)
    private var source: (any DispatchSourceRead)?
    private var timer: (any DispatchSourceTimer)?
    private var lines = BridgeLineBuffer()
    private var session = BridgeSession()
    private var limiter: BridgeRateLimiter
    private let openedAt = ContinuousClock.now
    private var lastActivity = ContinuousClock.now
    private var isClosed = false

    init(
        socket: Int32, sequence: UInt64, handler: any BridgeMessageHandler, limits: BridgeConnectionLimits,
        onClose: @escaping @Sendable (BridgeConnection) -> Void
    ) {
        self.socket = socket
        self.sequence = sequence
        self.handler = handler
        self.limits = limits
        self.onClose = onClose
        limiter = BridgeRateLimiter(perSecond: limits.messagesPerSecond, burst: limits.burst)
        queue = DispatchQueue(label: "dev.monkifocus.bridge.connection")
    }

    /// Whether a valid `hello` arrived (only such connections get broadcasts).
    var hasGreeted: Bool {
        greetedFlag.withLock { $0 }
    }

    func start() {
        queue.async { [self] in
            let source = DispatchSource.makeReadSource(fileDescriptor: socket, queue: queue)
            source.setEventHandler { [weak self] in self?.readAvailable() }
            source.setCancelHandler { [socket] in Darwin.close(socket) }
            self.source = source
            source.resume()
            let timer = DispatchSource.makeTimerSource(queue: queue)
            let tick = min(limits.helloTimeoutSeconds, limits.idleTimeoutSeconds) / 4
            timer.schedule(deadline: .now() + tick, repeating: tick)
            timer.setEventHandler { [weak self] in self?.checkDeadlines() }
            self.timer = timer
            timer.resume()
        }
    }

    /// Sends a message the app pushes (`rules.snapshot`, `focusSession.state`, ...).
    func send(_ message: BridgeMessage) {
        queue.async { [self] in
            guard !isClosed else { return }
            write(message)
        }
    }

    func close() {
        queue.async { [self] in closeNow() }
    }

    private func checkDeadlines() {
        guard !isClosed else { return }
        let now = ContinuousClock.now
        if !hasGreeted, now - openedAt >= .seconds(limits.helloTimeoutSeconds) {
            BridgeLog.event("no hello in time; connection closed")
            closeNow()
        } else if now - lastActivity >= .seconds(limits.idleTimeoutSeconds) {
            BridgeLog.event("idle connection closed")
            closeNow()
        }
    }

    private func readAvailable() {
        guard !isClosed else { return }
        var chunk = [UInt8](repeating: 0, count: 65_536)
        let count = chunk.withUnsafeMutableBytes { Darwin.read(socket, $0.baseAddress, $0.count) }
        if count < 0, errno == EAGAIN || errno == EINTR { return }
        guard count > 0 else {
            closeNow()
            return
        }
        let received: [Data]
        do {
            received = try lines.append(Data(chunk[0..<count]))
        } catch {
            BridgeLog.rejected(.tooLarge)
            closeNow()
            return
        }
        let now = ContinuousClock.now
        let seconds =
            Double((now - openedAt).components.seconds)
            + Double((now - openedAt).components.attoseconds) / 1e18
        for line in received {
            guard limiter.allow(at: seconds) else { continue }
            let message: BridgeMessage
            do {
                message = try BridgeMessage.decode(line, from: .extensionToApp)
            } catch {
                BridgeLog.rejected(error)
                closeNow()
                return
            }
            lastActivity = now
            let replies = handler.handle(message, session: &session)
            if session.browser != nil {
                greetedFlag.withLock { $0 = true }
            }
            for reply in replies {
                write(reply)
                if isClosed { return }
            }
        }
    }

    private func write(_ message: BridgeMessage) {
        var bytes = message.encoded(id: UUID().uuidString.lowercased())
        guard bytes.count <= BridgeContract.maxMessageBytes else {
            BridgeLog.event("outgoing message over the size limit dropped")
            return
        }
        bytes.append(UInt8(ascii: "\n"))
        var offset = 0
        while offset < bytes.count {
            let written = bytes.withUnsafeBytes { buffer in
                Darwin.write(socket, buffer.baseAddress?.advanced(by: offset), buffer.count - offset)
            }
            if written > 0 {
                offset += written
                continue
            }
            if written < 0, errno == EINTR { continue }
            if written < 0, errno == EAGAIN, waitUntilWritable() { continue }
            BridgeLog.event("write failed or timed out; connection closed")
            closeNow()
            return
        }
    }

    private func waitUntilWritable() -> Bool {
        var descriptor = pollfd(fd: socket, events: Int16(POLLOUT), revents: 0)
        return poll(&descriptor, 1, limits.writeTimeoutMilliseconds) == 1
            && descriptor.revents & Int16(POLLOUT) != 0
    }

    private func closeNow() {
        guard !isClosed else { return }
        isClosed = true
        timer?.cancel()
        timer = nil
        if let source {
            source.cancel()
        } else {
            Darwin.close(socket)
        }
        source = nil
        onClose(self)
    }
}
