// SPDX-License-Identifier: AGPL-3.0-or-later

/// What kind of bypass a `BypassEventRecord` reports (a snake_case code).
public enum BypassKind: String, Hashable, Sendable, CaseIterable {
    case emergencyOverride = "emergency_override"
}
