// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation

/// A schema the evaluator cannot run: a keyword outside the supported set or
/// a `$ref` that does not resolve. Fails loudly instead of skipping a check.
public enum SchemaError: Error, Equatable, Sendable {
    case unsupportedKeyword(String)
    case unresolvedReference(String)
    case invalidSchema(String)
}

/// A JSON Schema (draft 2020-12) evaluator for exactly the vocabulary the
/// v1 schemas of `packages/rules` use, plus extension keywords supplied by
/// the caller. It is hand-written because no maintained Swift library
/// validates draft 2020-12 with custom keywords and without network access;
/// an unknown keyword throws, so a schema that grows a new keyword fails
/// every test until the evaluator learns it.
///
/// Like ajv with `allErrors`, it reports every keyword that failed, including
/// those inside a failing `oneOf`/`anyOf` branch (so the rejection code does
/// not depend on evaluation order); keywords inside a passing combinator, an
/// `if` or a `not` are not reported.
struct JSONSchemaEvaluator: Sendable {
    typealias CustomKeyword = @Sendable (_ keywordValue: JSONValue, _ instance: JSONValue) -> Bool

    /// The result of evaluating an instance: valid, or the keywords that failed.
    struct Evaluation {
        var failedKeywords: [String] = []
        var errors: [String] = []

        var isValid: Bool { failedKeywords.isEmpty }

        mutating func fail(_ keyword: String, at path: String) {
            failedKeywords.append(keyword)
            errors.append("\(path.isEmpty ? "/" : path) \(keyword)")
        }

        mutating func merge(_ other: Evaluation) {
            failedKeywords += other.failedKeywords
            errors += other.errors
        }
    }

    private static let annotations: Set<String> = [
        "$schema", "$id", "$comment", "$defs", "title", "description", "examples", "default", "deprecated",
        "readOnly", "writeOnly",
    ]

    /// Schema documents by file name (`rule.schema.json`).
    private let documents: [String: JSONValue]
    private let customKeywords: [String: CustomKeyword]
    private let patterns: [String: NSRegularExpression]

    init(documents: [String: JSONValue], customKeywords: [String: CustomKeyword]) throws {
        self.documents = documents
        self.customKeywords = customKeywords
        var patterns: [String: NSRegularExpression] = [:]
        func collect(_ value: JSONValue) throws {
            switch value {
            case .object(let members):
                for (key, child) in members {
                    if key == "pattern", case .string(let pattern) = child, patterns[pattern] == nil {
                        do {
                            patterns[pattern] = try NSRegularExpression(pattern: pattern)
                        } catch {
                            throw SchemaError.invalidSchema("pattern \(pattern)")
                        }
                    }
                    try collect(child)
                }
            case .array(let items):
                for item in items { try collect(item) }
            default:
                break
            }
        }
        for document in documents.values { try collect(document) }
        self.patterns = patterns
    }

    /// Evaluates `instance` against the root of a schema document.
    func evaluate(document name: String, instance: JSONValue) throws -> Evaluation {
        guard let root = documents[name] else { throw SchemaError.unresolvedReference(name) }
        return try evaluate(root, base: name, instance: instance, path: "")
    }

    private func resolve(_ reference: String, base: String) throws -> (schema: JSONValue, base: String) {
        let parts = reference.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)
        let file = parts.first.map(String.init) ?? ""
        let pointer = parts.count > 1 ? String(parts[1]) : ""
        let target = file.isEmpty ? base : file
        guard let document = documents[target] else { throw SchemaError.unresolvedReference(reference) }
        guard let schema = pointer.isEmpty ? document : document.value(at: pointer) else {
            throw SchemaError.unresolvedReference(reference)
        }
        return (schema, target)
    }

    private func evaluate(_ schema: JSONValue, base: String, instance: JSONValue, path: String) throws -> Evaluation {
        var result = Evaluation()
        switch schema {
        case .bool(true):
            return result
        case .bool(false):
            result.fail("false", at: path)
            return result
        case .object(let keywords):
            for (keyword, value) in keywords.sorted(by: { $0.key < $1.key }) {
                try apply(keyword, value, in: keywords, base: base, instance: instance, path: path, into: &result)
            }
            return result
        default:
            throw SchemaError.invalidSchema(path)
        }
    }

    private func apply(
        _ keyword: String,
        _ value: JSONValue,
        in schema: [String: JSONValue],
        base: String,
        instance: JSONValue,
        path: String,
        into result: inout Evaluation
    ) throws {
        if Self.annotations.contains(keyword) { return }
        if let custom = customKeywords[keyword] {
            if !custom(value, instance) { result.fail(keyword, at: path) }
            return
        }
        switch keyword {
        case "$ref":
            guard case .string(let reference) = value else { throw SchemaError.invalidSchema(keyword) }
            let (target, targetBase) = try resolve(reference, base: base)
            result.merge(try evaluate(target, base: targetBase, instance: instance, path: path))
        case "type":
            let types: [String]
            switch value {
            case .string(let single): types = [single]
            case .array(let many): types = many.compactMap(\.stringValue)
            default: throw SchemaError.invalidSchema(keyword)
            }
            if !types.contains(where: { Self.hasType($0, instance) }) { result.fail(keyword, at: path) }
        case "enum":
            guard case .array(let allowed) = value else { throw SchemaError.invalidSchema(keyword) }
            if !allowed.contains(instance) { result.fail(keyword, at: path) }
        case "const":
            if value != instance { result.fail(keyword, at: path) }
        case "minLength", "maxLength":
            guard case .string(let text) = instance else { return }
            let length = text.unicodeScalars.count
            let limit = try Self.integer(value, keyword)
            if keyword == "minLength" ? length < limit : length > limit { result.fail(keyword, at: path) }
        case "pattern":
            guard case .string(let text) = instance else { return }
            guard case .string(let pattern) = value, let regex = patterns[pattern] else {
                throw SchemaError.invalidSchema(keyword)
            }
            let range = NSRange(text.startIndex..<text.endIndex, in: text)
            if regex.firstMatch(in: text, range: range) == nil { result.fail(keyword, at: path) }
        case "format":
            guard case .string(let text) = instance else { return }
            guard case .string(let format) = value else { throw SchemaError.invalidSchema(keyword) }
            if !(try Self.matchesFormat(format, text)) { result.fail(keyword, at: path) }
        case "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum":
            guard case .number(let number) = instance else { return }
            guard case .number(let limit) = value else { throw SchemaError.invalidSchema(keyword) }
            let holds =
                switch keyword {
                case "minimum": number >= limit
                case "maximum": number <= limit
                case "exclusiveMinimum": number > limit
                default: number < limit
                }
            if !holds { result.fail(keyword, at: path) }
        case "minItems", "maxItems":
            guard case .array(let items) = instance else { return }
            let limit = try Self.integer(value, keyword)
            if keyword == "minItems" ? items.count < limit : items.count > limit { result.fail(keyword, at: path) }
        case "uniqueItems":
            guard case .array(let items) = instance, value == .bool(true) else { return }
            if Set(items).count != items.count { result.fail(keyword, at: path) }
        case "items":
            guard case .array(let items) = instance else { return }
            for (index, item) in items.enumerated() {
                result.merge(try evaluate(value, base: base, instance: item, path: "\(path)/\(index)"))
            }
        case "minProperties", "maxProperties":
            guard case .object(let members) = instance else { return }
            let limit = try Self.integer(value, keyword)
            if keyword == "minProperties" ? members.count < limit : members.count > limit {
                result.fail(keyword, at: path)
            }
        case "required":
            guard case .object(let members) = instance else { return }
            guard case .array(let names) = value else { throw SchemaError.invalidSchema(keyword) }
            if names.contains(where: { $0.stringValue.map { members[$0] == nil } ?? true }) {
                result.fail(keyword, at: path)
            }
        case "properties":
            guard case .object(let members) = instance else { return }
            guard case .object(let properties) = value else { throw SchemaError.invalidSchema(keyword) }
            for (name, child) in members.sorted(by: { $0.key < $1.key }) {
                guard let propertySchema = properties[name] else { continue }
                result.merge(try evaluate(propertySchema, base: base, instance: child, path: "\(path)/\(name)"))
            }
        case "additionalProperties":
            guard case .object(let members) = instance else { return }
            let declared: [String: JSONValue]
            if case .object(let properties)? = schema["properties"] {
                declared = properties
            } else {
                declared = [:]
            }
            for (name, child) in members.sorted(by: { $0.key < $1.key }) where declared[name] == nil {
                let evaluation = try evaluate(value, base: base, instance: child, path: "\(path)/\(name)")
                if value == .bool(false) {
                    result.fail(keyword, at: "\(path)/\(name)")
                } else {
                    result.merge(evaluation)
                }
            }
        case "propertyNames":
            guard case .object(let members) = instance else { return }
            for name in members.keys.sorted() {
                result.merge(try evaluate(value, base: base, instance: .string(name), path: "\(path)/\(name)"))
            }
        case "allOf", "anyOf", "oneOf":
            guard case .array(let branches) = value else { throw SchemaError.invalidSchema(keyword) }
            let evaluations = try branches.map { try evaluate($0, base: base, instance: instance, path: path) }
            let passing = evaluations.filter(\.isValid).count
            let holds =
                switch keyword {
                case "allOf": passing == branches.count
                case "anyOf": passing >= 1
                default: passing == 1
                }
            if !holds {
                for evaluation in evaluations { result.merge(evaluation) }
                result.fail(keyword, at: path)
            }
        case "not":
            if try evaluate(value, base: base, instance: instance, path: path).isValid {
                result.fail(keyword, at: path)
            }
        case "if":
            let condition = try evaluate(value, base: base, instance: instance, path: path)
            let branch = condition.isValid ? schema["then"] : schema["else"]
            if let branch {
                let evaluation = try evaluate(branch, base: base, instance: instance, path: path)
                if !evaluation.isValid {
                    result.merge(evaluation)
                    result.fail(keyword, at: path)
                }
            }
        case "then", "else":
            // Evaluated by `if`; without an `if` they have no effect.
            return
        default:
            throw SchemaError.unsupportedKeyword(keyword)
        }
    }

    private static func integer(_ value: JSONValue, _ keyword: String) throws -> Int {
        guard case .number(let number) = value, number.rounded() == number, abs(number) < 1e15 else {
            throw SchemaError.invalidSchema(keyword)
        }
        return Int(number)
    }

    private static func hasType(_ type: String, _ instance: JSONValue) -> Bool {
        switch (type, instance) {
        case ("null", .null), ("boolean", .bool), ("string", .string), ("array", .array), ("object", .object),
            ("number", .number):
            return true
        case ("integer", .number(let number)):
            return number.rounded() == number
        default:
            return false
        }
    }

    /// `date-time` and `date` as ajv-formats checks them in full mode: real
    /// calendar dates, times up to 23:59:59 (a leap second only at 23:59 UTC).
    private static func matchesFormat(_ format: String, _ text: String) throws -> Bool {
        let scalars = Array(text.unicodeScalars)
        func number(_ range: Range<Int>) -> Int? {
            guard range.upperBound <= scalars.count else { return nil }
            var value = 0
            for index in range {
                guard ("0"..."9").contains(scalars[index]) else { return nil }
                value = value * 10 + Int(scalars[index].value - 48)
            }
            return value
        }
        func validDate() -> Bool {
            guard scalars.count >= 10, scalars[4] == "-", scalars[7] == "-", let year = number(0..<4),
                let month = number(5..<7), let day = number(8..<10), (1...12).contains(month)
            else { return false }
            return (1...CivilDate.daysIn(year: year, month: month)).contains(day)
        }
        switch format {
        case "date":
            return scalars.count == 10 && validDate()
        case "date-time":
            guard validDate(), scalars.count >= 20, "Tt ".unicodeScalars.contains(scalars[10]), scalars[13] == ":",
                scalars[16] == ":", let hour = number(11..<13), let minute = number(14..<16),
                let second = number(17..<19)
            else { return false }
            var index = 19
            if index < scalars.count, scalars[index] == "." {
                index += 1
                let start = index
                while index < scalars.count, ("0"..."9").contains(scalars[index]) { index += 1 }
                guard index > start else { return false }
            }
            var offsetMinutes = 0
            let zone = scalars[index...]
            if zone.count == 1, "Zz".unicodeScalars.contains(zone[zone.startIndex]) {
                offsetMinutes = 0
            } else if zone.count == 6, zone[zone.startIndex] == "+" || zone[zone.startIndex] == "-",
                zone[zone.startIndex + 3] == ":", let offsetHours = number((index + 1)..<(index + 3)),
                let offsetMinute = number((index + 4)..<(index + 6)), offsetHours <= 23, offsetMinute <= 59
            {
                offsetMinutes = (zone[zone.startIndex] == "-" ? -1 : 1) * (offsetHours * 60 + offsetMinute)
            } else {
                return false
            }
            guard hour <= 23, minute <= 59 else { return false }
            if second <= 59 { return true }
            guard second == 60 else { return false }
            let utcMinutes = ((hour * 60 + minute - offsetMinutes) % 1440 + 1440) % 1440
            return utcMinutes == 23 * 60 + 59
        default:
            throw SchemaError.unsupportedKeyword("format: \(format)")
        }
    }
}
