// SPDX-License-Identifier: AGPL-3.0-or-later
import { isIPv4 } from 'node:net'

/**
 * Whether a host name or address only reaches this machine: `localhost`,
 * 127.0.0.0/8, ::1 (bracketed or not) and IPv4-mapped 127.x. `0.0.0.0` and
 * `::` listen on every interface, so they are not loopback.
 */
export function isLoopbackHost(host: string): boolean {
  const bare = host
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
  if (bare === 'localhost' || bare === '::1') return true
  const v4 = bare.startsWith('::ffff:') ? bare.slice('::ffff:'.length) : bare
  return isIPv4(v4) && v4.startsWith('127.')
}

/** Whether a URL's host is loopback; false for anything that does not parse. */
export function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname)
  } catch {
    return false
  }
}
