// SPDX-License-Identifier: AGPL-3.0-or-later
import { base32Encode } from '#domain/auth/base32'

/**
 * A guardian link's ntfy topic. ntfy runs with `deny-all` and lets anyone
 * read `<prefix>*` topics, so the name **is** the capability
 * (docs/adr/0003-ntfy-capability-actions.md): 128 random bits, lowercase
 * base32 (26 characters), under the instance's `NTFY_TOPIC_PREFIX`
 * (default `mf-`). Only the server publishes; only the guardian is told
 * the name. Never logged.
 */

export const NTFY_TOPIC_BYTES = 16
/** `NTFY_TOPIC_PREFIX` when it is empty. */
export const DEFAULT_NTFY_TOPIC_PREFIX = 'mf-'
/** What ntfy accepts as a topic name. */
export const NTFY_TOPIC_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
/** What start/env_schema.ts accepts as a prefix. */
const PREFIX_PATTERN = /^[A-Za-z0-9_-]{1,16}$/

export function isNtfyTopic(value: unknown): value is string {
  return typeof value === 'string' && NTFY_TOPIC_PATTERN.test(value)
}

/** The topic for 16 random bytes (the caller draws them). */
export function ntfyTopicFromBytes(prefix: string, bytes: Uint8Array): string {
  if (bytes.length !== NTFY_TOPIC_BYTES) {
    throw new RangeError(`An ntfy topic needs exactly ${NTFY_TOPIC_BYTES} random bytes`)
  }
  if (!PREFIX_PATTERN.test(prefix)) throw new RangeError('Not an ntfy topic prefix')
  return `${prefix}${base32Encode(bytes).toLowerCase()}`
}
