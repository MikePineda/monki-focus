// SPDX-License-Identifier: AGPL-3.0-or-later

/// Where an instant falls relative to bedtime (SEMANTICS.md §6.2).
public enum BedtimePhase: String, Codable, CaseIterable, Sendable {
    case inactive
    case warning
    case active
}
