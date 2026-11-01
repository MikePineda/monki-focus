// SPDX-License-Identifier: AGPL-3.0-or-later

/// What app blocking may do to another app: hide it, or bring it back after
/// an intention or a granted override. There is deliberately no terminate
/// here: blocking never quits or force-quits an app (plan §4.5).
@MainActor
public protocol ApplicationControl: AnyObject {
    func hide(processIdentifier: Int32)
    func activate(processIdentifier: Int32)
}
