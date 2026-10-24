// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import Testing

/// Every user-facing string lives in `Localizable.xcstrings` and every key
/// is translated in every supported language. A key Xcode extracts from a
/// new `Text("…")` arrives untranslated, so this test also catches copy
/// that skipped the catalog.
@Suite("Localization parity")
struct LocalizationParityTests {
    static let languages = ["en", "es"]

    private static func catalog() throws -> [String: Any] {
        let data = try Data(contentsOf: TestResources.stringCatalog())
        return try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private static func strings() throws -> [String: [String: Any]] {
        try #require(try catalog()["strings"] as? [String: [String: Any]])
    }

    /// Every `stringUnit` under `node` (plain, plural or device variations).
    private static func stringUnits(in node: Any) -> [[String: Any]] {
        guard let dictionary = node as? [String: Any] else { return [] }
        if let unit = dictionary["stringUnit"] as? [String: Any] {
            return [unit]
        }
        return dictionary.values.flatMap { stringUnits(in: $0) }
    }

    @Test("the catalog's source language is English")
    func theCatalogsSourceLanguageIsEnglish() throws {
        #expect(try Self.catalog()["sourceLanguage"] as? String == "en")
    }

    @Test("the catalog is not empty")
    func theCatalogIsNotEmpty() throws {
        #expect(try !Self.strings().isEmpty)
    }

    @Test("every key is translated in every language", arguments: languages)
    func everyKeyIsTranslatedInEveryLanguage(language: String) throws {
        var missing: [String] = []
        for (key, entry) in try Self.strings() where entry["shouldTranslate"] as? Bool != false {
            let localization = (entry["localizations"] as? [String: Any])?[language]
            let units = localization.map { Self.stringUnits(in: $0) } ?? []
            let translated =
                !units.isEmpty
                && units.allSatisfy { unit in
                    unit["state"] as? String == "translated" && !((unit["value"] as? String) ?? "").isEmpty
                }
            if !translated {
                missing.append(key)
            }
        }

        #expect(missing.sorted().isEmpty, "Keys without a translated \(language) value: \(missing.sorted())")
    }

    @Test("the built app ships every language", arguments: languages)
    func theBuiltAppShipsEveryLanguage(language: String) throws {
        let path = try #require(Bundle.main.path(forResource: language, ofType: "lproj"), "no \(language).lproj")
        let bundle = try #require(Bundle(path: path))
        let missingMarker = "\u{0}missing"

        let title = bundle.localizedString(forKey: "today.title", value: missingMarker, table: nil)

        #expect(title != missingMarker)
        #expect(title != "today.title")
    }
}
