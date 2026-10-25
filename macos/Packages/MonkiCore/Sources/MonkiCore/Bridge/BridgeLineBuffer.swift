// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Splits a byte stream into NDJSON lines (one message per line, `\n`
/// terminated) for the app socket. A line longer than `maxLineBytes` is an
/// error as soon as it is seen, so a peer can never make the reader buffer
/// more than one oversized line's worth of bytes.
public struct BridgeLineBuffer: Sendable {
    public enum Failure: Error, Equatable, Sendable {
        case lineTooLong
    }

    private let maxLineBytes: Int
    private var pending = Data()

    public init(maxLineBytes: Int = BridgeContract.maxMessageBytes) {
        self.maxLineBytes = maxLineBytes
    }

    /// Bytes of an unfinished line.
    public var pendingByteCount: Int { pending.count }

    /// Appends `bytes` and returns every complete line (without its `\n`).
    public mutating func append(_ bytes: Data) throws(Failure) -> [Data] {
        pending.append(bytes)
        var lines: [Data] = []
        while let newline = pending.firstIndex(of: UInt8(ascii: "\n")) {
            let line = Data(pending[pending.startIndex..<newline])
            guard line.count <= maxLineBytes else { throw .lineTooLong }
            lines.append(line)
            pending = Data(pending[pending.index(after: newline)...])
        }
        guard pending.count <= maxLineBytes else { throw .lineTooLong }
        return lines
    }
}
