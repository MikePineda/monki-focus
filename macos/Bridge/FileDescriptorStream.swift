// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation

/// Blocking reads and writes on a raw file descriptor (stdin, stdout, the
/// app socket), retrying short transfers and `EINTR`.
enum FileDescriptorStream {
    enum Failure: Error {
        /// The stream ended inside a message.
        case truncated
        case system(errno: Int32)
    }

    /// Exactly `count` bytes; nil when the stream ends before the first byte.
    static func read(_ descriptor: Int32, count: Int) throws(Failure) -> Data? {
        var bytes = [UInt8](repeating: 0, count: count)
        var offset = 0
        while offset < count {
            let read = bytes.withUnsafeMutableBytes { buffer in
                Darwin.read(descriptor, buffer.baseAddress?.advanced(by: offset), count - offset)
            }
            if read < 0, errno == EINTR { continue }
            guard read >= 0 else { throw .system(errno: errno) }
            if read == 0 {
                if offset == 0 { return nil }
                throw .truncated
            }
            offset += read
        }
        return Data(bytes)
    }

    /// Whatever is available (at most `limit` bytes); empty at end of stream.
    static func readSome(_ descriptor: Int32, limit: Int = 65_536) throws(Failure) -> Data {
        var bytes = [UInt8](repeating: 0, count: limit)
        while true {
            let read = bytes.withUnsafeMutableBytes { Darwin.read(descriptor, $0.baseAddress, limit) }
            if read < 0, errno == EINTR { continue }
            guard read >= 0 else { throw .system(errno: errno) }
            return Data(bytes[0..<read])
        }
    }

    static func write(_ descriptor: Int32, _ data: Data) throws(Failure) {
        var offset = 0
        while offset < data.count {
            let written = data.withUnsafeBytes { buffer in
                Darwin.write(descriptor, buffer.baseAddress?.advanced(by: offset), data.count - offset)
            }
            if written < 0, errno == EINTR { continue }
            guard written > 0 else { throw .system(errno: errno) }
            offset += written
        }
    }
}
