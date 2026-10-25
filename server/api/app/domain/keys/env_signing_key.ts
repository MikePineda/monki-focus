// SPDX-License-Identifier: AGPL-3.0-or-later
import { KEY_ID_PATTERN } from '@monki-focus/protocol'
import { refuse, succeed, type Outcome } from '#domain/outcome'
import {
  signingKeyFromPkcs8,
  type KeyMaterialFailure,
  type SigningKeyMaterial,
} from '#domain/keys/signing_key_material'

export type EnvSigningKeyFailure = KeyMaterialFailure | 'incomplete_pair' | 'malformed_kid'

/**
 * The operator-supplied unlock signing key: `UNLOCK_SIGNING_KEY` (an
 * Ed25519 private key as unpadded base64url PKCS#8 DER) together with
 * `UNLOCK_SIGNING_KEY_ID` (its kid, which the operator also shows devices
 * at enrolment). Both or neither: neither means "the server generates and
 * stores its own key". The kid must be the one derived from the key, so a
 * typo never gets pinned by a client.
 *
 * Answers `null` when neither is set. Failures are reason codes only: the
 * key never appears in an error.
 */
export function parseEnvSigningKey(values: {
  key?: string
  kid?: string
}): Outcome<SigningKeyMaterial | null, EnvSigningKeyFailure> {
  const key = values.key?.trim() ?? ''
  const kid = values.kid?.trim() ?? ''
  if (key === '' && kid === '') return succeed(null)
  if (key === '' || kid === '') return refuse('incomplete_pair')
  if (!KEY_ID_PATTERN.test(kid)) return refuse('malformed_kid')

  const material = signingKeyFromPkcs8('unlock', key)
  if (!material.ok) return material
  if (material.value.kid !== kid) return refuse('kid_mismatch')
  return material
}
