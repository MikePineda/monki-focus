// SPDX-License-Identifier: AGPL-3.0-or-later
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { isKeyPurpose } from '#domain/keys/signing_key_record'

/**
 * `node ace signing-key:rotate --purpose=unlock|policy`
 *
 * The active key of the purpose retires (its private key is erased) and
 * signs a key endorsement for a freshly generated successor, which becomes
 * active; devices adopt it offline through the endorsement in `/keys`.
 * Refused while a retired key of the purpose is still published (run
 * `signing-key:prune` first), so no purpose ever has more than two
 * verifiable keys.
 *
 * - `--from-env`: the successor is UNLOCK_SIGNING_KEY (unlock only).
 * - `--unendorsed`: recovery when the active key is lost (APP_KEY changed)
 *   or compromised. No endorsement: every device must be enrolled again.
 *
 * Prints kids only, never key material.
 */
export default class SigningKeyRotate extends BaseCommand {
  static commandName = 'signing-key:rotate'
  static description = 'Rotate the unlock or policy signing key (the old key endorses the new one)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Key purpose: unlock or policy', required: true })
  declare purpose: string

  @flags.boolean({ description: 'Use UNLOCK_SIGNING_KEY as the new unlock key' })
  declare fromEnv?: boolean

  @flags.boolean({
    description: 'Recovery only: no endorsement, every device has to be enrolled again',
  })
  declare unendorsed?: boolean

  async run() {
    if (!isKeyPurpose(this.purpose)) {
      this.logger.error('--purpose must be unlock or policy')
      this.exitCode = 1
      return
    }
    const { default: Clock } = await import('#services/clock')
    const { SigningKeyError } = await import('#services/signing_key_store')
    const { tokenIssuerIdentity } = await import('#services/token_issuer_identity')
    const { default: env } = await import('#start/env')
    const keys = await this.app.container.make('signingKeys')
    const clock = await this.app.container.make(Clock)

    try {
      const result = await keys.rotate(
        this.purpose,
        Math.floor(clock.now().toSeconds()),
        tokenIssuerIdentity(),
        { successor: this.fromEnv === true ? 'env' : 'generate', endorse: this.unendorsed !== true }
      )
      this.logger.success(`The ${this.purpose} key ${result.kid} is active`)
      if (result.retiredKid !== null) {
        this.logger.info(
          `Key ${result.retiredKid} is retired: still published and verifying until signing-key:prune`
        )
      }
      if (!result.endorsed && result.retiredKid !== null) {
        this.logger.warning(
          'No endorsement was signed: every device must be enrolled again to pin the new key'
        )
      }
      if (
        this.purpose === 'unlock' &&
        this.fromEnv !== true &&
        env.get('UNLOCK_SIGNING_KEY') !== undefined
      ) {
        this.logger.warning(
          'Remove UNLOCK_SIGNING_KEY and UNLOCK_SIGNING_KEY_ID before restarting: the server only starts with the active unlock key'
        )
      }
    } catch (error) {
      if (!(error instanceof SigningKeyError)) throw error
      this.logger.error(error.message)
      this.exitCode = 1
    }
  }
}
