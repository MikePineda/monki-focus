// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The `ruleSet` member of a rule set write, read from the raw JSON body:
 * the body parser turns empty strings into null (`convertEmptyStringsToNull`),
 * which would refuse a valid `"note": ""`, and `request.input` would also
 * read the query string, which must never carry a rule set. Undefined when
 * the body is not a JSON object with an object `ruleSet`.
 */
export function ruleSetOfRawBody(raw: string | null | undefined): unknown {
  if (typeof raw !== 'string' || raw === '') return undefined
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return undefined
  const ruleSet = (body as Record<string, unknown>).ruleSet
  return ruleSet !== null && typeof ruleSet === 'object' && !Array.isArray(ruleSet)
    ? ruleSet
    : undefined
}
