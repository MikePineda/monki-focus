// SPDX-License-Identifier: AGPL-3.0-or-later
import proxyAddr from 'proxy-addr'

/**
 * Peers allowed to set X-Forwarded-* (CLIENT_IP_HEADER has its own
 * CLIENT_IP_HEADER_FROM ranges, see app/http/client_ip.ts):
 * loopback (local runs, tests, a self-hoster's proxy on the same host) and
 * private ranges (Traefik on the Docker network). A public peer reached the
 * server directly, so whatever it claims about the client is ignored.
 */
const trusted = proxyAddr.compile(['loopback', 'uniquelocal'])

export function isTrustedProxy(address: string): boolean {
  return trusted(address, 0)
}
