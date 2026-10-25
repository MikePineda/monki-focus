// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import Foundation
import MonkiCore

/// Prepares the socket's folder and path before `bind`. The folder is opened
/// with `O_NOFOLLOW | O_DIRECTORY` and checked through that descriptor
/// (`fstat`, `fchmod`), so a symlink swapped in between cannot redirect the
/// checks: it must be a real directory owned by the user, with no ACL
/// entries, and is set to 0700, so no one else can reach the socket inside.
/// A socket already at the path is probed first: one that answers belongs to
/// a running app and is left alone (`inUse`); a stale one is removed;
/// anything else at the path is refused.
enum BridgeSocketDirectory {
    enum Failure: Error, Equatable {
        case directoryNotOwned
        case notADirectory
        case hasACL
        case pathOccupied
        case inUse
        case system(errno: Int32)
    }

    static func prepare(socketPath: String, owner: uid_t) throws(Failure) {
        let directory = (socketPath as NSString).deletingLastPathComponent
        let name = (socketPath as NSString).lastPathComponent
        if mkdir(directory, 0o700) != 0, errno != EEXIST {
            // Create missing parents (Application Support always exists for a real user).
            do {
                try FileManager.default.createDirectory(
                    atPath: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
            } catch {
                throw .system(errno: errno)
            }
        }
        let folder = open(directory, O_RDONLY | O_NOFOLLOW | O_DIRECTORY | O_CLOEXEC)
        guard folder >= 0 else { throw errno == ENOTDIR || errno == ELOOP ? .notADirectory : .system(errno: errno) }
        defer { close(folder) }

        var info = stat()
        guard fstat(folder, &info) == 0 else { throw .system(errno: errno) }
        guard info.st_mode & S_IFMT == S_IFDIR else { throw .notADirectory }
        guard info.st_uid == owner else { throw .directoryNotOwned }
        guard !hasACLEntries(folder) else { throw .hasACL }
        if info.st_mode & 0o7777 != 0o700, fchmod(folder, 0o700) != 0 { throw .system(errno: errno) }

        guard fstatat(folder, name, &info, AT_SYMLINK_NOFOLLOW) == 0 else {
            guard errno == ENOENT else { throw .system(errno: errno) }
            return
        }
        guard info.st_mode & S_IFMT == S_IFSOCK, info.st_uid == owner else { throw .pathOccupied }
        guard !answers(socketPath) else { throw .inUse }
        guard unlinkat(folder, name, 0) == 0 else { throw .system(errno: errno) }
    }

    /// Any entry in the folder's extended ACL could grant someone else access.
    private static func hasACLEntries(_ descriptor: Int32) -> Bool {
        guard let acl = acl_get_fd_np(descriptor, ACL_TYPE_EXTENDED) else { return false }
        defer { acl_free(UnsafeMutableRawPointer(acl)) }
        var entry: acl_entry_t?
        return acl_get_entry(acl, ACL_FIRST_ENTRY.rawValue, &entry) == 0
    }

    /// Whether something listens on the socket (a running app).
    private static func answers(_ path: String) -> Bool {
        guard let address = try? UnixSocketAddress.make(path: path) else { return false }
        let probe = socket(AF_UNIX, SOCK_STREAM, 0)
        guard probe >= 0 else { return false }
        defer { close(probe) }
        var on: Int32 = 1
        _ = setsockopt(probe, SOL_SOCKET, SO_NOSIGPIPE, &on, socklen_t(MemoryLayout<Int32>.size))
        return UnixSocketAddress.withSockaddr(address) { connect(probe, $0, $1) } == 0
    }
}
