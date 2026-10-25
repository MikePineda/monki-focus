// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { OptionsApp } from '../../options/OptionsApp'
import { downloadFile } from '../../pages/FileDownload'
import { createCommandClient } from '../../shared/CommandClient'
import { startPage } from '../../ui/startPage'

const client = createCommandClient((message) => browser.runtime.sendMessage(message))

void startPage({
  titleKey: 'options.title',
  content: (
    <OptionsApp
      client={client}
      permissions={browser.permissions}
      optionalPermissions={browser.permissions}
      download={downloadFile}
      version={browser.runtime.getManifest().version}
    />
  ),
})
