// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { isIP } from 'node:net'
import { addressMatcher, parseAddressRanges } from '#http/address_ranges'

/** The slice of an HTTP context that client IP resolution reads. */
export interface ClientIpContext {
  request: {
    header(name: string): string | undefined | null
    ip(): string
  }
}

export interface ClientIpPolicy {
  /** CLIENT_IP_HEADER, lowercased; undefined = no header is ever read. */
  header?: string
  /**
   * Whether the forwarded hop may vouch for the header: the address
   * `request.ip()` resolved (the CDN edge as the local proxy saw it), checked
   * against CLIENT_IP_HEADER_FROM. Empty ranges = never.
   */
  trustedFrom: (address: string) => boolean
}

/**
 * The one way to read the client's IP (rate limits, audit). Pure: the
 * policy comes in as a parameter.
 *
 * `request.ip()` is the hop the local proxy saw (X-Forwarded-For honoured
 * only from the proxies in config/app.ts `trustProxy`). The configured
 * header, for example `cf-connecting-ip`, wins only when that hop is inside
 * CLIENT_IP_HEADER_FROM (the CDN's published ranges) and the value is a
 * single IP address: anyone else could have written the header, and a list
 * (X-Forwarded-For style) has a client-supplied leftmost entry.
 */
export function resolveClientIp(ctx: ClientIpContext, policy: ClientIpPolicy): string {
  const hop = ctx.request.ip()
  if (!policy.header || !policy.trustedFrom(hop)) return hop
  const claimed = ctx.request.header(policy.header)?.trim()
  return claimed && isIP(claimed) !== 0 ? claimed : hop
}

let configured: ClientIpPolicy | undefined

/** This instance's policy (CLIENT_IP_HEADER + CLIENT_IP_HEADER_FROM), compiled once. */
function configuredPolicy(): ClientIpPolicy {
  configured ??= {
    header: env.get('CLIENT_IP_HEADER'),
    trustedFrom: addressMatcher(parseAddressRanges(env.get('CLIENT_IP_HEADER_FROM'))),
  }
  return configured
}

/** The client IP with this instance's policy (no header trusted by default). */
export function clientIp(ctx: ClientIpContext): string {
  return resolveClientIp(ctx, configuredPolicy())
}
