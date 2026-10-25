// SPDX-License-Identifier: AGPL-3.0-or-later
import { compareSemanticVersions, parseSemanticVersion } from '#domain/clients/semantic_version'

/** Client platforms of the device API (`X-Client-Version: <platform>/<semver>`). */
export const CLIENT_PLATFORMS = ['chrome_extension', 'android', 'macos', 'other'] as const

export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number]

/** Minimum accepted version per platform; a missing entry accepts any version. */
export type ClientMinimums = Partial<Record<ClientPlatform, string>>

export type ClientVersionVerdict =
  | { kind: 'accepted'; platform: ClientPlatform; version: string }
  | { kind: 'invalid' }
  | { kind: 'upgrade_required'; platform: ClientPlatform; minimumVersion: string }

/** The header's maximum length in the device API contract. */
const MAX_HEADER_LENGTH = 64

/**
 * Decides whether a device client may talk to this server: the header must
 * be `<platform>/<semver>` (packages/protocol openapi.yaml, `ClientVersion`),
 * and the version must not be older than the platform's minimum. An older
 * client gets `upgrade_required` (HTTP 426) and keeps enforcing locally.
 */
export function judgeClientVersion(
  header: string | null | undefined,
  minimums: ClientMinimums
): ClientVersionVerdict {
  if (!header || header.length > MAX_HEADER_LENGTH) return { kind: 'invalid' }
  const separator = header.indexOf('/')
  const platform = header.slice(0, separator)
  const version = header.slice(separator + 1)
  if (separator < 0 || !isClientPlatform(platform)) return { kind: 'invalid' }

  const parsed = parseSemanticVersion(version)
  if (!parsed) return { kind: 'invalid' }

  const minimumVersion = minimums[platform]
  const minimum = minimumVersion ? parseSemanticVersion(minimumVersion) : null
  if (minimumVersion && minimum && compareSemanticVersions(parsed, minimum) < 0) {
    return { kind: 'upgrade_required', platform, minimumVersion }
  }
  return { kind: 'accepted', platform, version }
}

function isClientPlatform(value: string): value is ClientPlatform {
  return (CLIENT_PLATFORMS as readonly string[]).includes(value)
}
