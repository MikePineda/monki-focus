// SPDX-License-Identifier: AGPL-3.0-or-later

/// What one bridge connection may cost the app.
public struct BridgeConnectionLimits: Sendable {
    /// A connection that has not sent a valid `hello` by then is closed.
    public var helloTimeoutSeconds: Double
    /// A connection silent for this long is closed (the extension reconnects).
    public var idleTimeoutSeconds: Double
    /// Messages per second on average; more are dropped.
    public var messagesPerSecond: Double
    /// Messages accepted at once before the rate applies.
    public var burst: Int
    /// A reply that cannot be written for this long closes the connection.
    public var writeTimeoutMilliseconds: Int32

    public init(
        helloTimeoutSeconds: Double = 5, idleTimeoutSeconds: Double = 600, messagesPerSecond: Double = 10,
        burst: Int = 40, writeTimeoutMilliseconds: Int32 = 5_000
    ) {
        self.helloTimeoutSeconds = helloTimeoutSeconds
        self.idleTimeoutSeconds = idleTimeoutSeconds
        self.messagesPerSecond = messagesPerSecond
        self.burst = burst
        self.writeTimeoutMilliseconds = writeTimeoutMilliseconds
    }
}
