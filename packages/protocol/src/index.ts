// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * `@monki-focus/protocol`: the reference implementation of the monki-focus
 * token protocol (PASETO v4.public) on `node:crypto`. The normative spec is
 * `docs/protocol/unlock-tokens.md`; the conformance suite every platform
 * runs is `fixtures/`.
 */
export { decodeBase64Url, encodeBase64Url } from './base64url.ts'
export * from './claim_formats.ts'
export { checkClaimTimes, checkTimeWindow, type ClaimTimes } from './claim_times.ts'
export { constantTimeEqual } from './constant_time_equal.ts'
export {
  ED25519_PUBLIC_KEY_BYTES,
  ED25519_SEED_BYTES,
  ED25519_SIGNATURE_BYTES,
  privateKeyFromSeed,
  publicKeyFromRaw,
  rawPublicKey,
} from './ed25519_key.ts'
export { implicitAssertion, implicitAssertionText } from './implicit_assertion.ts'
export { issuePolicyToken, issueUnlockToken, type SigningKey } from './issue_token.ts'
export { deriveKeyId, KEY_ID_LENGTH } from './key_id.ts'
export { createKeyring, MAX_ACTIVE_KEYS, type Keyring, type PinnedKey } from './keyring.ts'
export { encodeKidFooter, parseKidFooter } from './kid_footer.ts'
export { le64, pae } from './pae.ts'
export {
  canonicalPolicyClaims,
  isPolicyClaims,
  POLICY_CLAIM_KEYS,
  type PolicyClaims,
} from './policy_claims.ts'
export {
  activate,
  applyRevocations,
  deactivate,
  emptyReplayLedger,
  purge,
  PURGE_AFTER_EXP_SECONDS,
  recordReceipt,
  type ReplayEntry,
  type ReplayLedger,
  type ReplayStatus,
} from './replay_ledger.ts'
export { formatRfc3339Utc, parseRfc3339Utc, RFC3339_UTC_PATTERN } from './rfc3339_utc.ts'
export { signV4Public } from './sign_v4_public.ts'
export {
  TOKEN_ERROR_CODES,
  type Result,
  type TokenError,
  type TokenErrorCode,
} from './token_error.ts'
export {
  MAX_TOKEN_LENGTH,
  parseTokenParts,
  V4_PUBLIC_HEADER,
  type TokenParts,
} from './token_parts.ts'
export {
  CLOCK_SKEW_SECONDS,
  TOKEN_PURPOSES,
  type TokenPurpose,
  type TokenPurposeSpec,
} from './token_purpose.ts'
export { trustedNow, type DeviceClock, type TimeAnchor } from './trusted_time.ts'
export {
  canonicalUnlockClaims,
  isUnlockClaims,
  UNLOCK_CLAIM_KEYS,
  UNLOCK_MAX_DURATION_SECONDS,
  UNLOCK_MIN_DURATION_SECONDS,
  unlockDurationFits,
  type UnlockClaims,
  type UnlockScope,
} from './unlock_claims.ts'
export { checkReceipt, receiveUnlock, type UnlockReceipt } from './unlock_receipt.ts'
export {
  verifyPolicyToken,
  verifyUnlockToken,
  type VerificationContext,
  type VerifiedToken,
} from './verify_token.ts'
export {
  verifyV4Public,
  verifyV4PublicParts,
  type VerifiedV4Public,
  type VerifyV4PublicOptions,
} from './verify_v4_public.ts'
