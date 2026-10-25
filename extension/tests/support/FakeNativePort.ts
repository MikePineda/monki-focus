// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NativePort } from '../../src/background/native/NativePort'

/**
 * A native messaging port the test plays the host side of (`Http::fake` for
 * `connectNative`): it records what the extension posts and lets the test
 * answer or hang up.
 */
export class FakeNativePort implements NativePort {
  readonly posted: unknown[] = []
  disconnected = false
  private readonly messageListeners: ((message: unknown) => void)[] = []
  private readonly disconnectListeners: (() => void)[] = []

  readonly onMessage = {
    addListener: (listener: (message: unknown) => void) => {
      this.messageListeners.push(listener)
    },
  }

  readonly onDisconnect = {
    addListener: (listener: () => void) => {
      this.disconnectListeners.push(listener)
    },
  }

  postMessage(message: unknown): void {
    if (this.disconnected) throw new Error('Attempting to use a disconnected port object')
    this.posted.push(message)
  }

  disconnect(): void {
    this.disconnected = true
  }

  /** The host sends `message` to the extension. */
  reply(message: unknown): void {
    for (const listener of this.messageListeners) listener(message)
  }

  /** The host goes away (exited, not found, crashed). */
  hangUp(): void {
    this.disconnected = true
    for (const listener of this.disconnectListeners) listener()
  }

  /** Posted messages of `type`. */
  postedOf(type: string): { type: string; payload: unknown }[] {
    return this.posted.filter(
      (message): message is { type: string; payload: unknown } =>
        (message as { type?: unknown }).type === type
    )
  }
}
