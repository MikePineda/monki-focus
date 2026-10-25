// SPDX-License-Identifier: AGPL-3.0-or-later

/// The bundled rules data the engine needs, passed in rather than read from
/// disk so the engine stays pure: site profiles (aliases and surface globs),
/// the surface registry (feed / permalink / utility) and the default
/// category assignments. Adapters build it once from `packages/rules` data.
public struct RulesCatalog: Hashable, Sendable {
    struct ProfileSurface: Hashable, Sendable {
        let surface: String
        let globs: [String]
    }

    struct CompiledProfile: Hashable, Sendable {
        let domain: String
        let surfaces: [ProfileSurface]
    }

    let aliases: AliasTable
    let profiles: [CompiledProfile]
    public let defaultCategories: [CategoryAssignment]
    private let kinds: [String: SurfaceKind]

    public init(siteProfiles: [SiteProfile], surfaces: [Surface], defaultCategories: [CategoryAssignment]) {
        var aliasMap: [String: String] = [:]
        for profile in siteProfiles {
            for alias in profile.aliases { aliasMap[alias] = profile.domain }
        }
        aliases = AliasTable(aliasMap)
        let compiled = siteProfiles.map { profile in
            CompiledProfile(
                domain: profile.domain,
                surfaces: profile.surfaces
                    .map { ProfileSurface(surface: $0.key, globs: $0.value) }
                    .sorted { CodeUnitOrder.less($0.surface, $1.surface) }
            )
        }
        // Longest domain first: a profile for a subdomain wins over its parent's (stable for ties).
        profiles = compiled.enumerated()
            .sorted { lhs, rhs in
                let lhsLength = lhs.element.domain.utf16.count
                let rhsLength = rhs.element.domain.utf16.count
                return lhsLength != rhsLength ? lhsLength > rhsLength : lhs.offset < rhs.offset
            }
            .map(\.element)
        var kinds: [String: SurfaceKind] = [:]
        for surface in surfaces { kinds[surface.id] = surface.kind }
        self.kinds = kinds
        self.defaultCategories = defaultCategories
    }

    /// Kind of a registered surface, or nil for an unknown id.
    func surfaceKind(_ surface: String) -> SurfaceKind? { kinds[surface] }

    /// §3.1 normalisation of a rule, category or unlock domain.
    func normaliseDomain(_ domain: String) -> String {
        MonkiCore.normaliseDomain(domain, aliases: aliases)
    }

    /// The profile whose domain equals the (normalised) host or is a dot-suffix of it.
    func profileForHost(_ host: String) -> CompiledProfile? {
        profiles.first { isDomainOrSubdomain(host, $0.domain) }
    }
}
