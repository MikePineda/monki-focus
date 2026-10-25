// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Binds the signing-key store and the unlock-token ledger as singletons and
 * the token issuance service (cheap, around both) per resolve, and, when the HTTP server boots (`web`
 * only: never ace, the REPL or tests), makes sure every purpose has an
 * active key that loads, decrypts and passes the strict checks. Any
 * problem (APP_KEY changed, UNLOCK_SIGNING_KEY not the active key, a
 * tampered row) stops the boot: the server never runs without keys it can
 * trust.
 */
export default class SigningKeysProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton('signingKeys', async () => {
      const { default: SigningKeyStore } = await import('#services/signing_key_store')
      return SigningKeyStore.fromEnvironment()
    })
    this.app.container.singleton('unlockTokenLedger', async () => {
      const { default: UnlockTokenLedgerStore } =
        await import('#services/unlock_token_ledger_store')
      return new UnlockTokenLedgerStore()
    })
    // Not a singleton: each resolve reads the current Clock binding (tests freeze it).
    this.app.container.bind('tokenIssuance', async (resolver) => {
      const [{ default: env }, { default: Clock }, { default: TokenIssuance }] = await Promise.all([
        import('#start/env'),
        import('#services/clock'),
        import('#services/token_issuance'),
      ])
      const { tokenIssuerIdentity } = await import('#services/token_issuer_identity')
      const { isRegistrableDomain } = await import('#services/public_suffix_list')
      const { unlockLifetimeCapSeconds } = await import('#domain/unlock/unlock_lifetime')
      const clock = await resolver.make(Clock)
      return new TokenIssuance({
        keys: await resolver.make('signingKeys'),
        ledger: await resolver.make('unlockTokenLedger'),
        identity: tokenIssuerIdentity(),
        now: () => Math.floor(clock.now().toSeconds()),
        lifetimeCapSeconds: unlockLifetimeCapSeconds(env.get('UNLOCK_TOKEN_MAX_MINUTES')),
        isRegistrableDomain,
      })
    })
  }

  async start() {
    if (this.app.getEnvironment() !== 'web') return
    const { default: Clock } = await import('#services/clock')
    const clock = await this.app.container.make(Clock)
    const keys = await this.app.container.make('signingKeys')
    const created = await keys.ensureKeys(Math.floor(clock.now().toSeconds()))
    if (created.length > 0) {
      const logger = await this.app.container.make('logger')
      logger.info({ kids: created }, 'created signing keys')
    }
  }
}

declare module '@adonisjs/core/types' {
  interface ContainerBindings {
    signingKeys: import('#services/signing_key_store').default
    unlockTokenLedger: import('#services/unlock_token_ledger_store').default
    tokenIssuance: import('#services/token_issuance').default
  }
}
