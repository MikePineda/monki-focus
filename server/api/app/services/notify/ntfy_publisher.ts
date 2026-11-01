// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NtfyMessage } from '#domain/notify/ntfy_message'

/** What a publish attempt answers: a short reason on failure (never a topic, URL or body). */
export type PublishResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

/**
 * The port to ntfy: providers/notify_provider.ts binds the HTTP client,
 * tests swap it for a recording fake. An abstract class so it is its own
 * container token.
 */
export abstract class NtfyPublisher {
  /** False when NTFY_BASE_URL is empty: the outbox then keeps every row for later. */
  abstract readonly configured: boolean
  abstract publish(message: NtfyMessage): Promise<PublishResult>
}

export const NTFY_PUBLISH_TIMEOUT_MS = 10_000

/**
 * `POST {NTFY_BASE_URL}` with the JSON message (topic in the body) and
 * `Authorization: Bearer NTFY_PUBLISH_TOKEN` when set. No redirects. The
 * failure reason is the status code or the network error code only.
 */
export class HttpNtfyPublisher extends NtfyPublisher {
  constructor(
    protected baseUrl: string | undefined,
    protected publishToken: string | undefined,
    protected timeoutMs = NTFY_PUBLISH_TIMEOUT_MS
  ) {
    super()
  }

  get configured(): boolean {
    return Boolean(this.baseUrl)
  }

  async publish(message: NtfyMessage): Promise<PublishResult> {
    if (!this.baseUrl) return { ok: false, reason: 'ntfy not configured' }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.publishToken) headers.Authorization = `Bearer ${this.publishToken}`
    try {
      const response = await fetch(this.baseUrl.replace(/\/+$/, '') + '/', {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      })
      await response.body?.cancel()
      return response.ok ? { ok: true } : { ok: false, reason: `ntfy answered ${response.status}` }
    } catch (error) {
      return { ok: false, reason: `ntfy unreachable: ${errorCode(error)}` }
    }
  }
}

function errorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timeout'
    const cause = (error as { cause?: { code?: unknown } }).cause
    if (cause && typeof cause.code === 'string') return cause.code.slice(0, 40)
    return error.name.slice(0, 40)
  }
  return 'unknown'
}
