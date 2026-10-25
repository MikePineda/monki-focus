// SPDX-License-Identifier: AGPL-3.0-or-later
import proxyAddr from 'proxy-addr'

/** An IPv4/IPv6 address with an optional prefix length; names such as `loopback` are refused. */
const RANGE = /^[0-9A-Fa-f:.]+(\/\d{1,3})?$/

/**
 * Parses a comma-separated list of CIDRs or single addresses
 * (`CLIENT_IP_HEADER_FROM`). Throws with a readable message on any bad entry.
 * Empty input is an empty list.
 */
export function parseAddressRanges(raw: string | undefined): string[] {
  const ranges = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  for (const range of ranges) {
    if (!RANGE.test(range)) throw new Error(`"${range}" is not an IP address or CIDR`)
  }
  try {
    proxyAddr.compile(ranges)
  } catch (error) {
    throw new Error(`invalid address range: ${(error as Error).message}`)
  }
  return ranges
}

/** Whether an address is inside any of the ranges; an empty list matches nothing. */
export function addressMatcher(ranges: string[]): (address: string) => boolean {
  if (ranges.length === 0) return () => false
  const matches = proxyAddr.compile(ranges)
  return (address) => matches(address, 0)
}
