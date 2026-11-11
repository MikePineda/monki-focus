// SPDX-License-Identifier: AGPL-3.0-or-later

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The origin of the server the user typed (`https://focus.example.org`), or
 * null when it is not one: https only, plain http only on loopback (a local
 * self-hosted instance). No credentials, path, query or fragment survive;
 * the device token is only ever sent to this origin.
 */
export function serverOrigin(typed: string): string | null {
  let url: URL
  try {
    url = new URL(typed.trim())
  } catch {
    return null
  }
  if (url.username !== '' || url.password !== '') return null
  if (url.protocol === 'https:') return url.origin
  if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) return url.origin
  return null
}

/** The optional host permission pattern for `origin` (`https://host/*`). */
export function originPermission(origin: string): string {
  const url = new URL(origin)
  return `${url.protocol}//${url.hostname}/*`
}
