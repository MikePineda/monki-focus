// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Finds source lines that read the time without an injected clock.
enum ImplicitClockScan {
    private static let implicitReads = [
        #"\bDate\(\s*\)"#,
        #"\bDate\.now\b"#,
        #"\bDate\(timeIntervalSinceNow:"#,
        #"\bCFAbsoluteTimeGetCurrent\("#,
        #"\bProcessInfo\.processInfo\.systemUptime\b"#,
        #"\bDispatch(Wall)?Time\.now\("#,
        #"\b(ContinuousClock|SuspendingClock)\b"#,
        #"\bmach_(absolute|continuous)_time\("#,
        #"\bclock_gettime(_nsec_np)?\("#,
        #"\bgettimeofday\("#,
    ]

    /// Whether `line` reads the time implicitly; comment lines never do.
    static func isImplicit(_ line: String) -> Bool {
        guard !line.trimmingCharacters(in: .whitespaces).hasPrefix("//") else {
            return false
        }
        return implicitReads.contains { line.range(of: $0, options: .regularExpression) != nil }
    }

    /// Every `.swift` file under `root`; throws when `root` does not exist.
    static func swiftFiles(under root: URL) throws -> [URL] {
        guard (try? root.checkResourceIsReachable()) == true,
            let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)
        else {
            throw CocoaError(.fileReadNoSuchFile, userInfo: [NSFilePathErrorKey: root.path])
        }
        return enumerator.compactMap { $0 as? URL }.filter { $0.pathExtension == "swift" }
    }

    /// Returns `file:line: source` for every offending line under `root`.
    static func scan(_ root: URL) throws -> [String] {
        try swiftFiles(under: root).flatMap { file in
            try String(contentsOf: file, encoding: .utf8)
                .split(separator: "\n", omittingEmptySubsequences: false)
                .enumerated()
                .filter { isImplicit(String($0.element)) }
                .map {
                    "\(file.lastPathComponent):\($0.offset + 1): \($0.element.trimmingCharacters(in: .whitespaces))"
                }
        }
    }
}
