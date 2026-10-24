// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The two kinds of monki-focus token. Each purpose has its own `typ` claim,
 * its own implicit-assertion domain and its own signing key, so a token of
 * one purpose can never be accepted as the other.
 */
export type TokenPurpose = 'unlock' | 'policy'

export interface TokenPurposeSpec {
  readonly typ: TokenPurpose
  /** Versioned domain-separation prefix of the implicit assertion. */
  readonly assertionPrefix: string
  /** Maximum `exp - iat`, in seconds. */
  readonly maxLifetimeSeconds: number
}

export const TOKEN_PURPOSES: Readonly<Record<TokenPurpose, TokenPurposeSpec>> = {
  unlock: {
    typ: 'unlock',
    assertionPrefix: 'monki-focus/unlock/v1',
    maxLifetimeSeconds: 4 * 60 * 60,
  },
  policy: {
    typ: 'policy',
    assertionPrefix: 'monki-focus/policy/v1',
    maxLifetimeSeconds: 30 * 24 * 60 * 60,
  },
}

/** Tolerated difference between the server clock and trusted now, both ways. */
export const CLOCK_SKEW_SECONDS = 60
