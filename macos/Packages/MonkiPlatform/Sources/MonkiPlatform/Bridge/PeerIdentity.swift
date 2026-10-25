// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin

/// Who is on the other end of a connected Unix socket.
public protocol PeerIdentity: Sendable {
    /// The peer's effective user id, or nil when the system cannot say.
    func userId(ofPeer socket: Int32) -> uid_t?
}

/// `getpeereid(2)`: the kernel's record of the peer's credentials at connect time.
public struct SocketPeerIdentity: PeerIdentity {
    public init() {}

    public func userId(ofPeer socket: Int32) -> uid_t? {
        var uid: uid_t = 0
        var gid: gid_t = 0
        return getpeereid(socket, &uid, &gid) == 0 ? uid : nil
    }
}
