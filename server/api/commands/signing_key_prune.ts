// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `node ace signing-key:prune [--force]`
 *
 * Deletes retired signing keys once every token they can have signed has
 * expired, plus a day (unlock: 4 h; policy: 30 days). `--force` deletes
 * every retired key now: tokens it signed stop verifying on devices that
 * refresh `/keys`. Active keys are never pruned. Prints kids only.
 */
export default class SigningKeyPrune extends BaseCommand {
  static commandName = 'signing-key:prune'
  static description = 'Delete retired signing keys whose tokens can no longer be in use'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Delete every retired key now, ignoring the grace period' })
  declare force?: boolean

  async run() {
    const { default: Clock } = await import('#services/clock')
    const keys = await this.app.container.make('signingKeys')
    const clock = await this.app.container.make(Clock)

    const pruned = await keys.prune(Math.floor(clock.now().toSeconds()), {
      force: this.force === true,
    })
    if (pruned.length === 0) {
      this.logger.info('No retired key is due for pruning')
      return
    }
    for (const kid of pruned) this.logger.success(`Pruned retired key ${kid}`)
  }
}
