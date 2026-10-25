// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether two **normalised** targets can match a common observation
// (SEMANTICS.md §8, outrank check): the same package; sites whose domains are
// equal or one is a dot-suffix of the other (paths ignored); the same
// surface; a site and a surface of that site's profile; an app and any surface.

private func domainsOverlap(_ lhs: String, _ rhs: String) -> Bool {
    isDomainOrSubdomain(lhs, rhs) || isDomainOrSubdomain(rhs, lhs)
}

private func siteHasSurface(domain: String, surface: String, _ catalog: RulesCatalog) -> Bool {
    let normalised = catalog.normaliseDomain(domain)
    return catalog.profiles.contains { profile in
        domainsOverlap(normalised, profile.domain) && profile.surfaces.contains { $0.surface == surface }
    }
}

private func surfaceOverlaps(_ surface: String, _ other: Target, _ catalog: RulesCatalog) -> Bool {
    switch other {
    case .surface(let otherSurface): otherSurface == surface
    case .app: true
    case .site(let domain, _): siteHasSurface(domain: domain, surface: surface, catalog)
    }
}

func targetsOverlap(_ lhs: Target, _ rhs: Target, _ catalog: RulesCatalog) -> Bool {
    if case .surface(let surface) = lhs { return surfaceOverlaps(surface, rhs, catalog) }
    if case .surface(let surface) = rhs { return surfaceOverlaps(surface, lhs, catalog) }
    switch (lhs, rhs) {
    case (.app(let lhsPackage), .app(let rhsPackage)):
        return lhsPackage == rhsPackage
    case (.site(let lhsDomain, _), .site(let rhsDomain, _)):
        return domainsOverlap(catalog.normaliseDomain(lhsDomain), catalog.normaliseDomain(rhsDomain))
    default:
        return false
    }
}
