// SPDX-License-Identifier: AGPL-3.0-or-later
import { isIPv4, isIPv6 } from 'node:net'

/**
 * The rate-limit bucket of a client address. IPv4 is one bucket per
 * address; IPv6 one per /64, because a single subscriber usually owns a
 * whole /64 and could otherwise rotate addresses for a fresh bucket each
 * request. IPv4-mapped IPv6 counts as its IPv4 address. Anything else is
 * returned as is.
 */
export function rateLimitBucket(address: string): string {
  const ip = address.trim().toLowerCase()
  if (isIPv4(ip)) return ip
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip)
  if (mapped && isIPv4(mapped[1])) return mapped[1]
  if (!isIPv6(ip.split('%')[0])) return address
  return `${hextets(ip).slice(0, 4).join(':')}::/64`
}

/** The eight 16-bit groups of an IPv6 address, without leading zeros. */
function hextets(ip: string): string[] {
  let text = ip.split('%')[0]
  const tail: string[] = []
  const embedded = /(\d+\.\d+\.\d+\.\d+)$/.exec(text)
  if (embedded) {
    const [a, b, c, d] = embedded[1].split('.').map(Number)
    tail.push(((a << 8) | b).toString(16), ((c << 8) | d).toString(16))
    text = text.slice(0, -embedded[1].length)
    if (text.endsWith(':') && !text.endsWith('::')) text = text.slice(0, -1)
  }
  const [head, rest] = text.split('::')
  const left = head ? head.split(':') : []
  const groups =
    rest === undefined
      ? [...left, ...tail]
      : (() => {
          const right = rest ? rest.split(':') : []
          const zeros = Array.from(
            { length: 8 - left.length - right.length - tail.length },
            () => '0'
          )
          return [...left, ...zeros, ...right, ...tail]
        })()
  return groups.map((group) => Number.parseInt(group, 16).toString(16))
}
