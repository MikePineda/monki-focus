// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Dispatch
import Foundation
import MonkiCore

/// One accepted `monki-bridge` connection: NDJSON in, NDJSON out, on its own
/// serial queue. Every line is validated as a message from the extension;
/// the first malformed line, an oversized line, a write that times out or the
/// peer hanging up closes this connection and no other.
final class BridgeConnection: @unchecked Sendable {
    // State below is only touched on `queue`.
    private let socket: Int32
    private let queue: DispatchQueue
    private let handler: any BridgeMessageHandler
    private let writeTimeoutMilliseconds: Int32
    private let onClose: @Sendable (BridgeConnection) -> Void
    private var source: (any DispatchSourceRead)?
    private var lines = BridgeLineBuffer()
    private var session = BridgeSession()
    private var isClosed = false

    init(
        socket: Int32, handler: any BridgeMessageHandler, writeTimeoutMilliseconds: Int32,
        onClose: @escaping @Sendable (BridgeConnection) -> Void
    ) {
        self.socket = socket
        self.handler = handler
        self.writeTimeoutMilliseconds = writeTimeoutMilliseconds
        self.onClose = onClose
        queue = DispatchQueue(label: "dev.monkifocus.bridge.connection")
    }

    func start() {
        queue.async { [self] in
            let source = DispatchSource.makeReadSource(fileDescriptor: socket, queue: queue)
            source.setEventHandler { [weak self] in self?.readAvailable() }
            source.setCancelHandler { [socket] in Darwin.close(socket) }
            self.source = source
            source.resume()
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
        for line in received {
            let message: BridgeMessage
            do {
                message = try BridgeMessage.decode(line, from: .extensionToApp)
            } catch {
                BridgeLog.rejected(error)
                closeNow()
                return
            }
            for reply in handler.handle(message, session: &session) {
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
        return poll(&descriptor, 1, writeTimeoutMilliseconds) == 1 && descriptor.revents & Int16(POLLOUT) != 0
    }

    private func closeNow() {
        guard !isClosed else { return }
        isClosed = true
        if let source {
            source.cancel()
        } else {
            Darwin.close(socket)
        }
        source = nil
        onClose(self)
    }
}
