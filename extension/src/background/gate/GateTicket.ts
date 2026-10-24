// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomLetters, webCryptoBytes, type RandomBytes } from '../../shared/RandomLetters'

/** `storage.session` key of this browser session's gate ticket. */
export const GATE_TICKET_NAME = 'gate.ticket'

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

/** 32 letters: about 150 bits. */
const TICKET_LETTERS = 32
const TICKET_PATTERN = /^[a-z]{32}$/

/**
 * A random secret per browser session, written only into the gate's
 * session DNR redirect (`gate.html?t=<ticket>&to=\0`). Pages can read
 * neither the session rules nor the gate tab's URL, so a `to` that arrives
 * with the right ticket was written by the extension's own redirect; any
 * other `?to=` is ignored (open-redirect protection). `storage.session` is
 * cleared with the browser session, and so are the session rules.
 */
export class GateTicket {
  private cached: Promise<string> | undefined

  constructor(
    private readonly storage: StorageArea,
    private readonly randomBytes: RandomBytes = webCryptoBytes
  ) {}

  current(): Promise<string> {
    this.cached ??= this.readOrCreate().catch((error: unknown) => {
      this.cached = undefined
      throw error
    })
    return this.cached
  }

  async verify(ticket: string): Promise<boolean> {
    const current = await this.current()
    if (ticket.length !== current.length) return false
    let difference = 0
    for (let index = 0; index < current.length; index += 1) {
      difference |= current.charCodeAt(index) ^ ticket.charCodeAt(index)
    }
    return difference === 0
  }

  private async readOrCreate(): Promise<string> {
    const stored = (await this.storage.get(GATE_TICKET_NAME))[GATE_TICKET_NAME]
    if (typeof stored === 'string' && TICKET_PATTERN.test(stored)) return stored
    const ticket = randomLetters(TICKET_LETTERS, this.randomBytes)
    await this.storage.set({ [GATE_TICKET_NAME]: ticket })
    return ticket
  }
}
