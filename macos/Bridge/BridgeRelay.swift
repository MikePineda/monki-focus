// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation
import MonkiCore

/// The stateless relay between the browser and the app:
///
/// - browser → app: a 4-byte native-order length and that much JSON on
///   stdin becomes one NDJSON line on the socket;
/// - app → browser: one NDJSON line on the socket becomes a framed message
///   on stdout.
///
/// Both directions are capped at 1 MiB and checked at the envelope level
/// only (`BridgeEnvelope`): `v`, `id`, a type that belongs to the direction
/// it travels, an object payload. The original bytes are relayed untouched;
/// the payload is never interpreted, stored or logged. The process ends with
/// status 0 when either side closes (the browser closing stdin, the app
/// closing the socket) and with status 1 on anything malformed, which the
/// extension sees as a disconnect.
enum BridgeRelay {
    static func run() -> Never {
        signal(SIGPIPE, SIG_IGN)
        guard let path = AppSocketConnector.socketPath() else { exit(1) }
        switch AppSocketConnector.connect(path: path) {
        case .appUnavailable:
            // The app is not running: say so once and leave; the extension
            // keeps working on its own and reconnects later.
            let frame = (try? NativeMessageFrame.encode(BridgeReply.appUnavailable)) ?? Data()
            try? FileDescriptorStream.write(STDOUT_FILENO, frame)
            exit(0)
        case .refused:
            exit(1)
        case .connected(let socket):
            Thread.detachNewThread {
                exit(appToBrowser(socket: socket))
            }
            exit(browserToApp(socket: socket))
        }
    }

    /// Framed stdin → NDJSON socket, until the browser closes stdin.
    static func browserToApp(socket: Int32) -> Int32 {
        while true {
            do {
                guard
                    let header = try FileDescriptorStream.read(STDIN_FILENO, count: NativeMessageFrame.headerByteCount)
                else { return 0 }
                let length = try NativeMessageFrame.payloadLength(header: header)
                guard let payload = try FileDescriptorStream.read(STDIN_FILENO, count: length), payload.count == length
                else { return 1 }
                // A raw line feed would split the NDJSON line; compact JSON never has one.
                guard !payload.contains(UInt8(ascii: "\n")) else { return 1 }
                _ = try BridgeEnvelope.parse(payload, from: .extensionToApp)
                try FileDescriptorStream.write(socket, payload + Data([UInt8(ascii: "\n")]))
            } catch {
                return 1
            }
        }
    }

    /// NDJSON socket → framed stdout, until the app closes the socket.
    static func appToBrowser(socket: Int32) -> Int32 {
        var lines = BridgeLineBuffer(maxLineBytes: BridgeContract.maxMessageBytes)
        while true {
            do {
                let chunk = try FileDescriptorStream.readSome(socket)
                guard !chunk.isEmpty else { return lines.pendingByteCount == 0 ? 0 : 1 }
                for line in try lines.append(chunk) {
                    _ = try BridgeEnvelope.parse(line, from: .appToExtension)
                    try FileDescriptorStream.write(STDOUT_FILENO, try NativeMessageFrame.encode(line))
                }
            } catch {
                return 1
            }
        }
    }
}
