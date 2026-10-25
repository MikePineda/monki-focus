// SPDX-License-Identifier: AGPL-3.0-or-later

import Darwin
import MonkiPlatform

/// Peers that all claim to be someone else.
struct OtherUserPeers: PeerIdentity {
    func userId(ofPeer socket: Int32) -> uid_t? {
        getuid() + 1
    }
}
