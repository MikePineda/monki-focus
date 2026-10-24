// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { gateClient } from '../../gate/GateClient'
import { parseHandoff } from '../../gate/GateHandoff'
import { GatePage } from '../../gate/GatePage'
import { runtimeClock } from '../../shared/RuntimeClock'
import { startPage } from '../../ui/startPage'

// The intention gate (E6). It never navigates to a destination from its own
// URL: the DNR hand-off (`?t=<ticket>&to=`) goes to the service worker, which
// keeps the destination per tab, and the address bar is cleaned at once so a
// reload asks the service worker again.
const handoff = parseHandoff(location.search)
if (location.search !== '') history.replaceState(null, '', location.pathname)

const clock = runtimeClock()
void clock.ready.then(() =>
  startPage({
    titleKey: 'gate.title',
    shell: false,
    content: (
      <GatePage
        client={gateClient((message) => browser.runtime.sendMessage(message))}
        clock={clock}
        handoff={handoff}
        navigate={(url) => location.replace(url)}
        closeWindow={() => window.close()}
      />
    ),
  })
)
