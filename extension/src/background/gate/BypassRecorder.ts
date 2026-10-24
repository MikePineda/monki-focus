// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BypassEventPayload } from '../storage/db'
import type { GateDiagnosticCode } from './GateDiagnostics'

/** `storage.local` key of bypasses the outbox could not take yet. */
export const PENDING_BYPASSES_NAME = 'gate.pendingBypasses'
/** `storage.local` flag: a bypass happened that could be recorded nowhere (the popup shows it). */
export const BYPASS_UNRECORDED_NAME = 'bypass.unrecorded'

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

interface PendingBypass {
  event: BypassEventPayload
  enqueuedAt: string
}

/** The slice of `Outbox` the recorder writes to. */
export interface BypassOutbox {
  enqueueBypass(event: BypassEventPayload, enqueuedAt: string): Promise<void>
}

export type BypassRecord = 'outbox' | 'fallback' | 'unrecorded'

function isPendingList(value: unknown): value is PendingBypass[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PendingBypass).enqueuedAt === 'string' &&
        typeof (entry as PendingBypass).event === 'object'
    )
  )
}

/**
 * An emergency override is always granted and always recorded: into the
 * IndexedDB outbox; if that fails, into a queue in `storage.local` that the
 * next successful open drains into the outbox; and if both fail the
 * `bypass.unrecorded` flag is set so the user sees it. Recording never
 * throws: the override must not depend on it.
 */
export class BypassRecorder {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly outbox: () => Promise<BypassOutbox>,
    private readonly storage: StorageArea,
    private readonly diagnose: (code: GateDiagnosticCode) => void
  ) {}

  record(event: BypassEventPayload, enqueuedAt: string): Promise<BypassRecord> {
    return this.exclusive(async (): Promise<BypassRecord> => {
      try {
        const outbox = await this.outbox()
        await outbox.enqueueBypass(event, enqueuedAt)
        await this.drainInto(outbox).catch(() => undefined)
        return 'outbox'
      } catch {
        this.diagnose('outbox.unavailable')
      }
      try {
        const pending = await this.pending()
        await this.storage.set({ [PENDING_BYPASSES_NAME]: [...pending, { event, enqueuedAt }] })
        this.diagnose('bypass.fallbackQueued')
        return 'fallback'
      } catch {
        this.diagnose('bypass.unrecorded')
      }
      await this.storage.set({ [BYPASS_UNRECORDED_NAME]: true }).catch(() => undefined)
      return 'unrecorded'
    })
  }

  /** Moves the queued bypasses into the outbox once it opens; answers how many moved. */
  drain(): Promise<number> {
    return this.exclusive(async () => this.drainInto(await this.outbox()))
  }

  private async drainInto(outbox: BypassOutbox): Promise<number> {
    const pending = await this.pending()
    if (pending.length === 0) return 0
    for (const { event, enqueuedAt } of pending) await outbox.enqueueBypass(event, enqueuedAt)
    await this.storage.set({ [PENDING_BYPASSES_NAME]: [] })
    return pending.length
  }

  private async pending(): Promise<PendingBypass[]> {
    const stored = (await this.storage.get(PENDING_BYPASSES_NAME))[PENDING_BYPASSES_NAME]
    return isPendingList(stored) ? stored : []
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }
}
