// SPDX-License-Identifier: AGPL-3.0-or-later
import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'
import { CommandRouter } from '../background/commands/CommandRouter'
import { createCommandHandlers } from '../background/commands/commands'
import { systemClock } from '../shared/clock'

// Wiring only: every behaviour lives in a module under src/background.
export default defineBackground(() => {
  const router = new CommandRouter(
    browser.runtime.id,
    createCommandHandlers({ clock: systemClock })
  )
  router.listen(browser.runtime.onMessage)
})
