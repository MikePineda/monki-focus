// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// Validates rules documents (rule sets, site profiles, fixtures, …) against
/// the JSON Schemas of `packages/rules/schema/v1` plus the extension keywords
/// every platform enforces (SEMANTICS.md §1):
///
/// - `x-uniqueBy: <pointer>`: array items must differ at that JSON pointer,
///   site targets compared normalised (`www.`/`m.` dropped, aliases
///   rewritten, globs lower-cased, the catch-all glob as no path) → `duplicate_key`;
/// - `x-registrableDomain`: two labels after normalisation and not a bare
///   public suffix → `invalid_domain`;
/// - `x-timeZone`: resolvable by `TimeZone(identifier:)`, case-sensitively → `invalid_time_zone`;
/// - documents over 256 KiB of UTF-8 → `too_large`; text that is not strict
///   JSON → `invalid_json` (stricter than `JSON.parse`: a duplicate object key
///   is rejected too); anything else → `schema`.
///
/// Pure: the schema documents (file name without `.schema.json` → JSON) and
/// the site profiles' aliases are passed in, so the app can bundle them and
/// tests read them from `packages/rules`. Nothing is fetched: every `$ref`
/// resolves among the given schemas. The schemas run on
/// ``JSONSchemaEvaluator`` (why it is hand-written is documented there).
public struct RulesetValidator: Sendable {
    /// Hard limit for any rules document (rule set, profile, pack, fixture): 256 KiB of UTF-8.
    public static let maxDocumentBytes = 256 * 1024

    static let uniqueByExtension = "x-uniqueBy"
    static let registrableDomainExtension = "x-registrableDomain"
    static let timeZoneExtension = "x-timeZone"

    private let evaluator: JSONSchemaEvaluator
    private let schemaNames: Set<String>

    /// - Parameters:
    ///   - schemas: schema name (`ruleset`) → the schema document's JSON text.
    ///   - aliases: alias domain → canonical domain pairs of the site profiles, in profile order.
    public init(schemas: [String: String], aliases: [(alias: String, canonical: String)]) throws {
        var documents: [String: JSONValue] = [:]
        for (name, text) in schemas {
            documents[name + ".schema.json"] = try StrictJSONParser.parse(text)
        }
        let normaliser = ValidationTargetNormaliser(aliases: aliases)
        let custom: [String: JSONSchemaEvaluator.CustomKeyword] = [
            Self.uniqueByExtension: { pointer, instance in
                guard case .array(let items) = instance, case .string(let pointer) = pointer else { return true }
                let keys = items.map { normaliser.canonicalTarget($0.value(at: pointer)) }
                return Set(keys).count == keys.count
            },
            Self.registrableDomainExtension: { enabled, instance in
                guard case .string(let domain) = instance, enabled == .bool(true) else { return true }
                return normaliser.isRegistrableDomain(domain)
            },
            Self.timeZoneExtension: { enabled, instance in
                guard case .string(let zone) = instance, enabled == .bool(true) else { return true }
                return ZoneLookup.isResolvable(zone)
            },
        ]
        evaluator = try JSONSchemaEvaluator(documents: documents, customKeywords: custom)
        schemaNames = Set(schemas.keys)
    }

    /// Validates an already parsed document.
    public func validate(schema: String, value: JSONValue) -> ValidationResult {
        guard schemaNames.contains(schema) else { return .rejected(.schema, errors: ["unknown_schema: \(schema)"]) }
        let evaluation: JSONSchemaEvaluator.Evaluation
        do {
            evaluation = try evaluator.evaluate(document: schema + ".schema.json", instance: value)
        } catch {
            return .rejected(.schema, errors: ["unsupported_schema: \(error)"])
        }
        if evaluation.isValid { return .valid }
        return .rejected(Self.code(of: evaluation.failedKeywords), errors: evaluation.errors)
    }

    /// Validates raw text: size limit first, then JSON syntax, then the schema.
    public func validateDocument(schema: String, text: String) -> ValidationResult {
        validateDocument(schema: schema, data: Data(text.utf8))
    }

    public func validateDocument(schema: String, data: Data) -> ValidationResult {
        if data.count > Self.maxDocumentBytes { return .rejected(.tooLarge, errors: ["document_too_large"]) }
        let value: JSONValue
        do {
            value = try StrictJSONParser.parse(data)
        } catch {
            return .rejected(.invalidJson, errors: ["invalid_json"])
        }
        return validate(schema: schema, value: value)
    }

    private static func code(of keywords: [String]) -> RejectionCode {
        if keywords.contains(uniqueByExtension) { return .duplicateKey }
        if keywords.contains(registrableDomainExtension) { return .invalidDomain }
        if keywords.contains(timeZoneExtension) { return .invalidTimeZone }
        return .schema
    }
}
