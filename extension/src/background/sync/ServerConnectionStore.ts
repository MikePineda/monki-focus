// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser } from 'wxt/browser'
import { EMPTY_SYNC_LEDGER, type SyncLedger } from './RuleSetSyncPlan'
import type { PinnedKids } from './ServerClient'

/** `browser.storage.local` key of the server connection (holds the device token). */
export const SERVER_CONNECTION_KEY = 'sync.server'

type StorageArea = Pick<Browser.storage.StorageArea, 'get' | 'set' | 'remove'>

/** The user's own server: the origin they typed and the device token it issued. */
export interface ServerConnection {
  origin: string
  /** `mfd_…`: never logged, only ever sent to `origin`. */
  token: string
  deviceUuid: string
  pinnedKids: PinnedKids
  ledger: SyncLedger
}

function isConnection(value: unknown): value is ServerConnection {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ServerConnection>
  return (
    typeof candidate.origin === 'string' &&
    typeof candidate.token === 'string' &&
    typeof candidate.deviceUuid === 'string' &&
    typeof candidate.pinnedKids === 'object' &&
    candidate.pinnedKids !== null
  )
}

/** The one server connection; absent means the extension stays local-only. */
export class ServerConnectionStore {
  constructor(private readonly storage: StorageArea) {}

  async load(): Promise<ServerConnection | null> {
    const stored: unknown = (await this.storage.get(SERVER_CONNECTION_KEY))[SERVER_CONNECTION_KEY]
    if (!isConnection(stored)) return null
    return { ...stored, ledger: { ...EMPTY_SYNC_LEDGER, ...stored.ledger } }
  }

  save(connection: ServerConnection): Promise<void> {
    return this.storage.set({ [SERVER_CONNECTION_KEY]: connection })
  }

  async saveLedger(ledger: SyncLedger): Promise<void> {
    const current = await this.load()
    if (current !== null) await this.save({ ...current, ledger })
  }

  /** Disconnect: the token is deleted, local rules stay as they are. */
  clear(): Promise<void> {
    return this.storage.remove(SERVER_CONNECTION_KEY)
  }
}
