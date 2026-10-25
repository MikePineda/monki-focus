// SPDX-License-Identifier: AGPL-3.0-or-later
import { isNtfyTopic } from '#domain/guardians/ntfy_topic'

/**
 * How the guardian subscribes to their link's topic from a phone: the
 * topic's web URL on the public ntfy server (also what the QR code holds),
 * and the `ntfy://` deep link the ntfy apps open (`?secure=false` for a
 * plain-http server, local setups only). Shown only to the guardian.
 */
export interface NtfySubscription {
  readonly topic: string
  readonly url: string
  readonly deepLink: string
  readonly qrPayload: string
}

export function ntfySubscription(publicBaseUrl: string, topic: string): NtfySubscription {
  if (!isNtfyTopic(topic)) throw new RangeError('Not an ntfy topic')
  const base = new URL(publicBaseUrl)
  const path = base.pathname.replace(/\/+$/, '')
  const url = `${base.origin}${path}/${topic}`
  const insecure = base.protocol === 'http:' ? '?secure=false' : ''
  return {
    topic,
    url,
    deepLink: `ntfy://${base.host}${path}/${topic}${insecure}`,
    qrPayload: url,
  }
}
