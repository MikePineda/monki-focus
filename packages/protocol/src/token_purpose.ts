// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The kinds of monki-focus token. Each purpose has its own `typ` claim and
 * its own implicit-assertion domain; unlock and policy tokens also have their
 * own signing keys. Time tokens are signed with the unlock key (they carry
 * the unlock revocation list) and are kept apart by `typ` and assertion.
 */
export type TokenPurpose = 'unlock' | 'policy' | 'time'

/** Purposes that have their own signing key and keyring. */
export type KeyPurpose = 'unlock' | 'policy'

export interface TokenPurposeSpec {
  readonly typ: TokenPurpose
  /** Versioned domain-separation prefix of the implicit assertion. */
  readonly assertionPrefix: string
  /** Keyring that verifies this purpose. */
  readonly keyPurpose: KeyPurpose
  /** Maximum `exp - iat`, in seconds (time tokens carry no validity window). */
  readonly maxLifetimeSeconds: number
}

export const TOKEN_PURPOSES: Readonly<Record<TokenPurpose, TokenPurposeSpec>> = {
  unlock: {
    typ: 'unlock',
    assertionPrefix: 'monki-focus/unlock/v1',
    keyPurpose: 'unlock',
    maxLifetimeSeconds: 4 * 60 * 60,
  },
  policy: {
    typ: 'policy',
    assertionPrefix: 'monki-focus/policy/v1',
    keyPurpose: 'policy',
    maxLifetimeSeconds: 30 * 24 * 60 * 60,
  },
  time: {
    typ: 'time',
    assertionPrefix: 'monki-focus/time/v1',
    keyPurpose: 'unlock',
    maxLifetimeSeconds: 0,
  },
}

/** Tolerated difference between the server clock and trusted now, both ways. */
export const CLOCK_SKEW_SECONDS = 60
