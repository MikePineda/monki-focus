// SPDX-License-Identifier: AGPL-3.0-or-later

/// Invalid input to an engine function. `decide` never throws it: it turns
/// any of these into the fail-closed decision (SEMANTICS.md §14).
public enum EngineError: Error, Equatable, Sendable {
    /// Text that is not an RFC 3339 instant with an explicit offset and whole seconds.
    case invalidInstant
    /// A time zone the time zone database cannot resolve.
    case unknownTimeZone
    /// An observation that fails its schema shape.
    case invalidObservation
    /// An adapter passed a value outside the function's domain (a negative clock reading).
    case invalidArgument
}
