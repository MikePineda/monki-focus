// SPDX-License-Identifier: AGPL-3.0-or-later

/// A token bucket for one bridge connection: `burst` messages at once, then
/// `perSecond` on average. A message over the limit is dropped, not queued,
/// so a flooding peer costs a counter, never memory. Pure: the caller passes
/// the monotonic time in seconds.
public struct BridgeRateLimiter: Sendable {
    public let perSecond: Double
    public let burst: Int
    private var tokens: Double
    private var last: Double?

    public init(perSecond: Double, burst: Int) {
        self.perSecond = perSecond
        self.burst = burst
        tokens = Double(burst)
    }

    /// Whether a message arriving at `seconds` (monotonic) may be handled.
    public mutating func allow(at seconds: Double) -> Bool {
        if let last, seconds > last {
            tokens = min(Double(burst), tokens + (seconds - last) * perSecond)
        }
        last = max(last ?? seconds, seconds)
        guard tokens >= 1 else { return false }
        tokens -= 1
        return true
    }
}
