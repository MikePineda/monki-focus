// SPDX-License-Identifier: AGPL-3.0-or-later
import { FakeNativePort } from './FakeNativePort'

/** `connectNative` that hands out a fresh fake port per call and remembers them. */
export class FakeNativeHost {
  readonly ports: FakeNativePort[] = []
  readonly hostNames: string[] = []
  failing = false

  readonly connect = (hostName: string): FakeNativePort => {
    this.hostNames.push(hostName)
    if (this.failing) throw new Error('Specified native messaging host not found.')
    const port = new FakeNativePort()
    this.ports.push(port)
    return port
  }

  get last(): FakeNativePort {
    const port = this.ports.at(-1)
    if (port === undefined) throw new Error('no port was opened')
    return port
  }
}
