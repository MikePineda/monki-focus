// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto'
import env from '#start/env'
import {
  DEFAULT_NTFY_TOPIC_PREFIX,
  NTFY_TOPIC_BYTES,
  ntfyTopicFromBytes,
} from '#domain/guardians/ntfy_topic'

/**
 * The instance side of ntfy topics: draws a fresh capability topic under
 * NTFY_TOPIC_PREFIX (default `mf-`) and names the server guardians
 * subscribe to (NTFY_PUBLIC_URL, else NTFY_BASE_URL; null when neither is
 * set). Read per call, so tests and the deploy panel can change them.
 */
export function drawNtfyTopic(): string {
  const prefix = env.get('NTFY_TOPIC_PREFIX') || DEFAULT_NTFY_TOPIC_PREFIX
  return ntfyTopicFromBytes(prefix, randomBytes(NTFY_TOPIC_BYTES))
}

export function ntfyPublicBaseUrl(): string | null {
  return env.get('NTFY_PUBLIC_URL') || env.get('NTFY_BASE_URL') || null
}
