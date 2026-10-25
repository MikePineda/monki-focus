// SPDX-License-Identifier: AGPL-3.0-or-later
import env from '#start/env'
import { isIP } from 'node:net'
import { isTrustedProxy } from '#http/trusted_proxy'

/** The slice of an HTTP context that client IP resolution reads. */
export interface ClientIpContext {
  request: {
    header(name: string): string | undefined | null
    ip(): string
    request: { socket: { remoteAddress?: string } }
  }
}

/**
 * The one way to read the client's IP (rate limits, audit). Pure: the
 * proxy header name comes in as a parameter (CLIENT_IP_HEADER).
 *
 * - `header` set (for example `cf-connecting-ip` behind Cloudflare): its
 *   value wins only when the TCP peer is a trusted local proxy and the
 *   value is a single IP address. A public peer could forge the header, and
 *   a list (X-Forwarded-For style) has a client-supplied leftmost entry.
 * - Otherwise `request.ip()`, which honours X-Forwarded-For from trusted
 *   proxies only (config/app.ts `trustProxy`).
 *
 * The peer is checked on the socket, not on `request.ip()`: behind a CDN,
 * `request.ip()` resolves to an edge address shared by many users.
 */
export function resolveClientIp(ctx: ClientIpContext, header: string | undefined): string {
  if (header) {
    const peer = ctx.request.request.socket.remoteAddress
    const claimed = ctx.request.header(header)?.trim()
    if (claimed && isIP(claimed) !== 0 && peer && isTrustedProxy(peer)) return claimed
  }
  return ctx.request.ip()
}

/** The client IP with this instance's CLIENT_IP_HEADER (empty for self-hosters by default). */
export function clientIp(ctx: ClientIpContext): string {
  return resolveClientIp(ctx, env.get('CLIENT_IP_HEADER'))
}
