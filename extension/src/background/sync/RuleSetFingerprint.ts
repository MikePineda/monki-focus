// SPDX-License-Identifier: AGPL-3.0-or-later

/** Members the local editor and engine own; the server stores them as sent. */
const EDITOR_MEMBERS = new Set(['revision', 'updatedAt', 'pendingTimeZone'])

/**
 * Unpadded base64url SHA-256 of a rule set's canonical JSON (keys sorted at
 * every depth, no whitespace) without its editor members, so the same rules
 * have the same fingerprint on every device whatever revision each one gave
 * them. Also the heartbeat's `rulesHash`.
 */
export async function ruleSetFingerprint(ruleSet: unknown): Promise<string> {
  const top =
    ruleSet !== null && typeof ruleSet === 'object' && !Array.isArray(ruleSet)
      ? Object.fromEntries(Object.entries(ruleSet).filter(([key]) => !EDITOR_MEMBERS.has(key)))
      : ruleSet
  return sha256Base64Url(canonicalJson(top))
}

/** Unpadded base64url SHA-256 of `text` (UTF-8). */
export async function sha256Base64Url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  let binary = ''
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, member]) => member !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
