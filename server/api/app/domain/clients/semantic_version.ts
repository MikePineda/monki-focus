// SPDX-License-Identifier: AGPL-3.0-or-later

/** A parsed `major.minor.patch[-prerelease]` version. */
export interface SemanticVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** Parses a semantic version; null when the text is not one. */
export function parseSemanticVersion(text: string): SemanticVersion | null {
  const match = PATTERN.exec(text)
  if (!match) return null
  const [major, minor, patch] = [match[1], match[2], match[3]].map(Number)
  if (![major, minor, patch].every(Number.isSafeInteger)) return null
  return { major, minor, patch, prerelease: match[4] ? match[4].split('.') : [] }
}

/**
 * Semver precedence (semver.org §11): negative when `a` is older, zero when
 * equal, positive when newer. A prerelease is older than its release.
 */
export function compareSemanticVersions(a: SemanticVersion, b: SemanticVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] - b[key]
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    return b.prerelease.length - a.prerelease.length
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index++) {
    const left = a.prerelease[index]
    const right = b.prerelease[index]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric && rightNumeric) return Number(left) - Number(right)
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return left < right ? -1 : 1
  }
  return 0
}
