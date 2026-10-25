// SPDX-License-Identifier: AGPL-3.0-or-later

// Target matching (SEMANTICS.md §3.1). Domains are normalised like hosts
// first. A site target without a path, or with `/**`, matches every path,
// also an unknown one; any other glob must match the observed path and never
// matches an unknown path. A surface target matches any observation whose
// resolved surface equals it, on the web and in an app alike.

func matchesTarget(_ target: Target, _ observation: ResolvedObservation, _ catalog: RulesCatalog) -> Bool {
    switch target {
    case .app(let package):
        if case .app(let observed, _) = observation { return observed == package }
        return false
    case .surface(let surface):
        return observation.surface == surface
    case .site(let domain, let glob):
        guard case .site(let host, let path, let pathKnown, _) = observation,
            isDomainOrSubdomain(host, catalog.normaliseDomain(domain))
        else { return false }
        guard let glob, glob != catchAllGlob else { return true }
        return pathKnown && matchesGlob(glob, path)
    }
}

/// The unknown-path match of §5.5: a site target whose domain matches the
/// host (any path), or a surface target of the host's site profile.
func matchesHostOfUnknownPath(_ target: Target, host: String, _ catalog: RulesCatalog) -> Bool {
    switch target {
    case .app:
        false
    case .site(let domain, _):
        isDomainOrSubdomain(host, catalog.normaliseDomain(domain))
    case .surface(let surface):
        catalog.profileForHost(host)?.surfaces.contains { $0.surface == surface } ?? false
    }
}
