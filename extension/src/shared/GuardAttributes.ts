// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Names of the two `<html>` attributes the feed stylesheet keys on: `hide`
 * lists the surfaces whose page content is hidden, `restrict` the surfaces
 * whose entry points and page containers are hidden on every page. They are
 * random per page, so a site cannot recognise the extension by a fixed
 * attribute name or strip it with a fixed selector.
 */
export interface GuardAttributes {
  hide: string
  restrict: string
}

const NAME_LETTERS = 12
const GUARD_ATTRIBUTE_NAME = new RegExp(`^data-[a-z]{${NAME_LETTERS}}$`)
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'

/** A name this extension could have generated (also what the worker accepts). */
export function isGuardAttributeName(name: unknown): name is string {
  return typeof name === 'string' && GUARD_ATTRIBUTE_NAME.test(name)
}

export function isGuardAttributes(value: unknown): value is GuardAttributes {
  if (typeof value !== 'object' || value === null) return false
  const { hide, restrict } = value as Record<string, unknown>
  return isGuardAttributeName(hide) && isGuardAttributeName(restrict) && hide !== restrict
}

function randomName(randomBytes: (size: number) => Uint8Array): string {
  const bytes = randomBytes(NAME_LETTERS)
  let letters = ''
  for (const byte of bytes) letters += ALPHABET[byte % ALPHABET.length]
  return `data-${letters}`
}

/** Fresh random names (WebCrypto); the two never collide. */
export function randomGuardAttributes(
  randomBytes: (size: number) => Uint8Array = (size) => crypto.getRandomValues(new Uint8Array(size))
): GuardAttributes {
  const hide = randomName(randomBytes)
  let restrict = randomName(randomBytes)
  while (restrict === hide) restrict = randomName(randomBytes)
  return { hide, restrict }
}
