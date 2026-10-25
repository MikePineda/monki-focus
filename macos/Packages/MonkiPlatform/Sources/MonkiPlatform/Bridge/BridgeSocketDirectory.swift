// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation

/// Prepares the socket's folder and path before `bind`: the folder exists,
/// is a real directory (not a symlink), belongs to the user and is 0700, so
/// no one else can reach the socket inside; a stale socket from a previous
/// run is removed, anything else at the path is left alone and refused.
enum BridgeSocketDirectory {
    enum Failure: Error, Equatable {
        case directoryNotOwned
        case notADirectory
        case pathOccupied
        case system(errno: Int32)
    }

    static func prepare(socketPath: String, owner: uid_t) throws(Failure) {
        let directory = (socketPath as NSString).deletingLastPathComponent
        if mkdir(directory, 0o700) != 0, errno != EEXIST {
            // Create missing parents (Application Support always exists for a real user).
            do {
                try FileManager.default.createDirectory(
                    atPath: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            } catch {
                throw .system(errno: errno)
            }
        }
        var info = stat()
        guard lstat(directory, &info) == 0 else { throw .system(errno: errno) }
        guard info.st_mode & S_IFMT == S_IFDIR else { throw .notADirectory }
        guard info.st_uid == owner else { throw .directoryNotOwned }
        if info.st_mode & 0o777 != 0o700, chmod(directory, 0o700) != 0 { throw .system(errno: errno) }

        guard lstat(socketPath, &info) == 0 else {
            guard errno == ENOENT else { throw .system(errno: errno) }
            return
        }
        guard info.st_mode & S_IFMT == S_IFSOCK, info.st_uid == owner else { throw .pathOccupied }
        guard unlink(socketPath) == 0 else { throw .system(errno: errno) }
    }
}
