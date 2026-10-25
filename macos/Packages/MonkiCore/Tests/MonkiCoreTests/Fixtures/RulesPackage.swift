// SPDX-License-Identifier: AGPL-3.0-or-later

import Foundation
import MonkiCore
import MonkiCoreTesting

/// `packages/rules` read in place from the checkout (nothing is copied):
/// the schemas, the bundled rules data and the catalog and validator built
/// from them, once per test process.
enum RulesPackage {
    struct LoadError: Error, CustomStringConvertible {
        let description: String
    }

    static func url(_ relative: String) -> URL {
        RepositoryPaths.rulesPackage.appending(path: relative)
    }

    static func files(in relative: String, extension pathExtension: String) throws -> [URL] {
        try FileManager.default.contentsOfDirectory(at: url(relative), includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == pathExtension }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// Schema name (file name without `.schema.json`) → schema text.
    static func loadSchemas() throws -> [String: String] {
        var schemas: [String: String] = [:]
        for file in try files(in: "schema/v1", extension: "json") where file.lastPathComponent.hasSuffix(".schema.json")
        {
            let name = String(file.lastPathComponent.dropLast(".schema.json".count))
            schemas[name] = try String(contentsOf: file, encoding: .utf8)
        }
        return schemas
    }

    static func loadSiteProfiles() throws -> [SiteProfile] {
        try files(in: "data/sites", extension: "json").map {
            try StrictJSONDecoder().decode(SiteProfile.self, from: Data(contentsOf: $0))
        }
    }

    static func loadCatalog() throws -> RulesCatalog {
        let surfaces = try StrictJSONDecoder().decode(
            SurfaceRegistry.self,
            from: Data(contentsOf: url("data/surfaces.json"))
        )
        let categories = try StrictJSONDecoder().decode(
            CategoryCatalog.self,
            from: Data(contentsOf: url("data/categories/default.json"))
        )
        return RulesCatalog(
            siteProfiles: try loadSiteProfiles(),
            surfaces: surfaces.surfaces,
            defaultCategories: categories.assignments
        )
    }

    static func loadValidator() throws -> RulesetValidator {
        let aliases = try loadSiteProfiles().flatMap { profile in
            profile.aliases.map { (alias: $0, canonical: profile.domain) }
        }
        return try RulesetValidator(schemas: try loadSchemas(), aliases: aliases)
    }

    private static let loadedCatalog = Result { try loadCatalog() }
    private static let loadedValidator = Result { try loadValidator() }

    static func catalog() throws -> RulesCatalog { try loadedCatalog.get() }

    static func validator() throws -> RulesetValidator { try loadedValidator.get() }
}
