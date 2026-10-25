// SPDX-License-Identifier: AGPL-3.0-or-later

/// Whether the app may point the browsers' host manifest at the helper in
/// its own bundle. Not from a translocated copy (Gatekeeper runs a quarantined
/// app from a random read-only path that disappears), a mounted disk image or
/// a temporary folder: the manifest would name a helper that soon is gone, or
/// one anybody could swap.
public enum HostManifestPlacement {
    public static func allows(bundlePath: String) -> Bool {
        guard bundlePath.hasPrefix("/"), bundlePath.hasSuffix(".app") || bundlePath.hasSuffix(".app/") else {
            return false
        }
        let refused = [
            "/AppTranslocation/", "/Volumes/", "/private/var/folders/", "/var/folders/", "/tmp/", "/private/tmp/",
        ]
        return !refused.contains { bundlePath.contains($0) || bundlePath.hasPrefix($0) }
    }
}
