// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { PopupApp } from '../../popup/PopupApp'
import { systemClock } from '../../shared/clock'
import { createCommandClient } from '../../shared/CommandClient'
import { startPage } from '../../ui/startPage'

const client = createCommandClient((message) => browser.runtime.sendMessage(message))

void startPage({
  titleKey: 'popup.title',
  content: (
    <PopupApp
      client={client}
      permissions={browser.permissions}
      clock={systemClock}
      openOptions={(section) => {
        void browser.tabs.create({ url: browser.runtime.getURL(`/options.html#${section}`) })
        window.close()
      }}
      openExtensionSettings={() => {
        void browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` })
        window.close()
      }}
    />
  ),
})
