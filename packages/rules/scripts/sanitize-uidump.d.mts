// SPDX-License-Identifier: AGPL-3.0-or-later

export interface UidumpAllowlist {
  placeholder: string
  labels: string[]
  placeholderHosts: string[]
}

export const TEXT_ATTRIBUTES: readonly string[]
export const ALLOWED_COMMENTS: readonly string[]
export const SANITIZED_MARKER: string

export function loadAllowlist(path?: string): UidumpAllowlist
export function isAllowedText(
  value: string,
  allowlist: UidumpAllowlist,
  extraLabels?: readonly string[]
): boolean
export function sanitizeUidump(
  xml: string,
  options?: { keep?: readonly string[]; allowlist?: UidumpAllowlist }
): string
export function findUnsanitized(xml: string, allowlist?: UidumpAllowlist): string[]
