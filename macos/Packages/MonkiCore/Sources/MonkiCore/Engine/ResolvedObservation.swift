// SPDX-License-Identifier: AGPL-3.0-or-later

/// What `decide` matches targets against: a site observation after URL
/// normalisation (§2), an app observation as its detector reported it, or a
/// rejected URL that matches nothing (§5.1).
enum ResolvedObservation: Hashable {
    case site(host: String, path: String, pathKnown: Bool, surface: String?)
    case app(package: String, surface: String?)
    case rejected

    init(_ observation: Observation, _ catalog: RulesCatalog) {
        switch observation {
        case .app(let package, let surface):
            self = .app(package: package, surface: surface)
        case .site(let urlText):
            switch normalizeUrl(urlText, catalog: catalog) {
            case .normalized(let host, let path, let pathKnown, let surface):
                self = .site(host: host, path: path, pathKnown: pathKnown, surface: surface)
            case .rejected:
                self = .rejected
            }
        }
    }

    var surface: String? {
        switch self {
        case .site(_, _, _, let surface), .app(_, let surface): surface
        case .rejected: nil
        }
    }

    /// A site observation whose path cannot be trusted (§5.5).
    var hasUnknownPath: Bool {
        if case .site(_, _, let pathKnown, _) = self { return !pathKnown }
        return false
    }

    /// The host of a site observation with an unknown path.
    var hostOfUnknownPath: String? {
        if case .site(let host, _, false, _) = self { return host }
        return nil
    }
}
