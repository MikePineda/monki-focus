// SPDX-License-Identifier: AGPL-3.0-or-later

/** 16 fresh random bytes, unpadded base64url (the heartbeat's `nonce`). */
export function requestNonce(
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (bytes) =>
    crypto.getRandomValues(bytes)
): string {
  let binary = ''
  for (const byte of random(new Uint8Array(16))) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
