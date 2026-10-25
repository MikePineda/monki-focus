// SPDX-License-Identifier: AGPL-3.0-or-later
import { CLOCK_SKEW_SECONDS, TOKEN_PURPOSES, type KeyPurpose } from '@monki-focus/protocol'
import type { SigningKeyRecord } from '#domain/keys/signing_key_record'

/**
 * The server's signing keys of every purpose, as lifecycle rules:
 *
 * - exactly one `active` key per purpose signs (the database enforces it
 *   with a partial unique index);
 * - a `retired` key no longer signs but is published and verifies until it
 *   is pruned, so tokens it signed shortly before a rotation still verify;
 * - at most one retired key per purpose at a time, so a client never needs
 *   more than two keys of a purpose (spec §2, "at most two active kids");
 * - a retired key may be pruned only once every token it can have signed
 *   has expired, plus a day of margin for devices that were offline.
 */

/** Extra time a retired key stays published after its last possible token expired. */
export const RETIRED_KEY_MARGIN_SECONDS = 24 * 60 * 60

/**
 * How long after retirement a key may still be needed: the purpose's
 * longest token lifetime (unlock 4 h, also covering time tokens, which are
 * checked within a minute; policy 30 days), the clock skew and the margin.
 * It uses the protocol maximum, not the instance setting, so lowering
 * `UNLOCK_TOKEN_MAX_MINUTES` never prunes a key early.
 */
export function retiredKeyGraceSeconds(purpose: KeyPurpose): number {
  return (
    TOKEN_PURPOSES[purpose].maxLifetimeSeconds + CLOCK_SKEW_SECONDS + RETIRED_KEY_MARGIN_SECONDS
  )
}

/** Keys of one purpose, the active key first, then retired keys newest first. */
export function keysOf(records: readonly SigningKeyRecord[], purpose: KeyPurpose) {
  return records
    .filter((record) => record.purpose === purpose)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return b.createdAt - a.createdAt || a.kid.localeCompare(b.kid)
    })
}

/** The one key that signs for `purpose`, if any. Retired keys never sign. */
export function activeKeyOf(
  records: readonly SigningKeyRecord[],
  purpose: KeyPurpose
): SigningKeyRecord | undefined {
  return keysOf(records, purpose).find((record) => record.status === 'active')
}

export function retiredKeysOf(records: readonly SigningKeyRecord[], purpose: KeyPurpose) {
  return keysOf(records, purpose).filter((record) => record.status === 'retired')
}

/** Retired keys whose grace has passed at `now` (epoch seconds); `force` ignores the grace. */
export function prunableKeys(
  records: readonly SigningKeyRecord[],
  now: number,
  options: { force?: boolean } = {}
): SigningKeyRecord[] {
  return records.filter(
    (record) =>
      record.status === 'retired' &&
      (options.force === true ||
        (record.retiredAt !== null &&
          record.retiredAt + retiredKeyGraceSeconds(record.purpose) <= now))
  )
}
