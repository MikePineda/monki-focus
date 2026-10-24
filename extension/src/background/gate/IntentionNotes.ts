// SPDX-License-Identifier: AGPL-3.0-or-later

/** `storage.session` key of the intentions' words and durations. */
export const INTENTION_NOTES_NAME = 'gate.intentions'

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

export interface IntentionNote {
  text: string
  minutes: number
}

interface NoteTable {
  byGroup: Record<string, IntentionNote>
  /** The last intention typed (any group): the next one must differ. */
  last: string | null
}

function isNoteTable(value: unknown): value is NoteTable {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { byGroup?: unknown }).byGroup === 'object' &&
    (value as { byGroup?: unknown }).byGroup !== null
  )
}

/** Case, accents' width and spacing do not make an intention new. */
export function normalisedIntention(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * The words of each group's current intention (for the overlay's "Your 10
 * min for «…» are up") and the last one typed. The text never reaches the
 * engine (it only gets the word count), IndexedDB, the outbox or a log; it
 * lives in `storage.session` and goes with the browser session.
 */
export class IntentionNotes {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(private readonly storage: StorageArea) {}

  async of(group: string): Promise<IntentionNote | null> {
    const { byGroup } = await this.table()
    return Object.hasOwn(byGroup, group) ? (byGroup[group] as IntentionNote) : null
  }

  /** Whether `text` repeats the last intention typed (empty text never does). */
  async repeatsLast(text: string): Promise<boolean> {
    const normalised = normalisedIntention(text)
    if (normalised === '') return false
    return (await this.table()).last === normalised
  }

  save(group: string, note: IntentionNote): Promise<void> {
    return this.exclusive(async () => {
      const table = await this.table()
      const normalised = normalisedIntention(note.text)
      await this.storage.set({
        [INTENTION_NOTES_NAME]: {
          byGroup: { ...table.byGroup, [group]: note },
          last: normalised === '' ? table.last : normalised,
        },
      })
    })
  }

  private async table(): Promise<NoteTable> {
    const stored = (await this.storage.get(INTENTION_NOTES_NAME))[INTENTION_NOTES_NAME]
    return isNoteTable(stored) ? stored : { byGroup: {}, last: null }
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }
}
