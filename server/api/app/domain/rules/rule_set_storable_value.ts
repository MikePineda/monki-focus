// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Deepest nesting a stored rule set may have (the schema needs fewer than
 * ten levels). Deeper documents are refused before anything recurses.
 */
export const MAX_RULE_SET_DEPTH = 64

const NUL = '\u0000'

function escapeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

function unstorable(text: string): boolean {
  return text.includes(NUL) || !text.isWellFormed()
}

/**
 * The JSON pointer of the first value Postgres `jsonb` cannot store or the
 * server should not walk: a string or key with U+0000 or a lone surrogate
 * (jsonb refuses both), or a container nested deeper than
 * `MAX_RULE_SET_DEPTH`. Null when the document is storable. Iterative, so
 * no input can exhaust the stack. The caller answers 422 at the pointer;
 * the shared schema stays as it is (clients already accept these strings).
 */
export function findUnstorableValue(document: unknown): { pointer: string } | null {
  const pending: Array<{ value: unknown; pointer: string; depth: number }> = [
    { value: document, pointer: '', depth: 0 },
  ]
  while (pending.length > 0) {
    const { value, pointer, depth } = pending.pop()!
    if (typeof value === 'string') {
      if (unstorable(value)) return { pointer: pointer || '/' }
      continue
    }
    if (value === null || typeof value !== 'object') continue
    if (depth >= MAX_RULE_SET_DEPTH) return { pointer: pointer || '/' }
    const entries: Array<[string, unknown]> = Array.isArray(value)
      ? value.map((child, index) => [String(index), child])
      : Object.entries(value)
    for (let index = entries.length - 1; index >= 0; index--) {
      const [key, child] = entries[index]
      const childPointer = `${pointer}/${escapeSegment(key)}`
      if (unstorable(key)) return { pointer: childPointer }
      pending.push({ value: child, pointer: childPointer, depth: depth + 1 })
    }
  }
  return null
}
