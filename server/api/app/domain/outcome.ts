// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What a domain operation answers: a value, or a stable reason code (never
 * text; callers map codes to i18n keys or HTTP errors).
 */
export type Outcome<T, Reason extends string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: Reason }

export function succeed<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value }
}

export function refuse<Reason extends string>(
  reason: Reason
): { readonly ok: false; readonly reason: Reason } {
  return { ok: false, reason }
}
