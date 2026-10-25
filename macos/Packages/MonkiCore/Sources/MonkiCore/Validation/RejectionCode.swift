// SPDX-License-Identifier: AGPL-3.0-or-later

/// Why a rules document was rejected (SEMANTICS.md §1); the `invalid` fixtures name these codes.
public enum RejectionCode: String, Codable, CaseIterable, Sendable {
    case schema
    case duplicateKey = "duplicate_key"
    case invalidDomain = "invalid_domain"
    case invalidTimeZone = "invalid_time_zone"
    case tooLarge = "too_large"
    case invalidJson = "invalid_json"
}

/// The outcome of validating a rules document. Errors name JSON pointers and keywords, never values.
public enum ValidationResult: Hashable, Sendable {
    case valid
    case rejected(RejectionCode, errors: [String])

    public var code: RejectionCode? {
        if case .rejected(let code, _) = self { return code }
        return nil
    }
}
