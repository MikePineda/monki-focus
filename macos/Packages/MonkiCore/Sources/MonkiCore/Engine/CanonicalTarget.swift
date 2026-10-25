// SPDX-License-Identifier: AGPL-3.0-or-later

/// The identity of a target after §3.1 normalisation (SEMANTICS.md §1):
/// normalised domain, lower-cased glob (globs compare case-insensitively)
/// and `/**` as no path. Two targets with the same key are the same target.
func canonicalTargetKey(_ target: Target, _ catalog: RulesCatalog) -> String {
    switch target {
    case .app(let package):
        return "app:" + package
    case .surface(let surface):
        return "surface:" + surface
    case .site(let domain, let path):
        let glob = path == nil || path == catchAllGlob ? "" : (path ?? "").lowercased()
        return "site:" + catalog.normaliseDomain(domain) + glob
    }
}
