// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// A short, private folder for one test's socket (Unix socket paths are limited to 103 bytes).
struct TemporarySocketFolder {
    let directory: URL
    let socketPath: String

    init() {
        directory = URL(filePath: "/tmp", directoryHint: .isDirectory)
            .appending(path: "mf-\(UUID().uuidString.prefix(8))", directoryHint: .isDirectory)
        socketPath = directory.appending(path: "bridge.sock").path
    }

    func remove() {
        try? FileManager.default.removeItem(at: directory)
    }
}
