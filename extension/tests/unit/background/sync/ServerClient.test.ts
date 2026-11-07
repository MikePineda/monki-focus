// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { ServerClient, ServerError } from '../../../../src/background/sync/ServerClient'
import { originPermission, serverOrigin } from '../../../../src/background/sync/ServerOrigin'

const ORIGIN = 'https://focus.example.org'
const TOKEN = `mfd_abc.${'s'.repeat(40)}`
const KID_U = 'u'.repeat(16)
const KID_P = 'p'.repeat(16)

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(answer: () => Response) {
  const calls: Call[] = []
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(answer())
  }
  return { calls, fetch }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function header(call: Call, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name]
}

function client(fetch: (url: string, init: RequestInit) => Promise<Response>, version = '0.4') {
  return new ServerClient({ origin: ORIGIN, fetch, extensionVersion: version })
}

describe('ServerClient', () => {
  it('enroll_posts_the_code_and_pins_the_answered_kids', async () => {
    const fake = fakeFetch(() =>
      json(201, {
        deviceUuid: '00000000-0000-4000-8000-000000000001',
        token: TOKEN,
        keys: {
          issuer: ORIGIN,
          keys: [
            { kid: KID_U, purpose: 'unlock' },
            { kid: KID_P, purpose: 'policy' },
          ],
        },
        serverTime: '2026-11-01T10:00:00Z',
      })
    )
    const enrollment = await client(fake.fetch).enroll('ABCDEFGH', 'Chrome')
    expect(enrollment).toEqual({
      deviceUuid: '00000000-0000-4000-8000-000000000001',
      token: TOKEN,
      pinnedKids: { unlock: [KID_U], policy: [KID_P] },
    })
    const [call] = fake.calls
    expect(call?.url).toBe(`${ORIGIN}/api/v1/device/enroll`)
    expect(call?.init.method).toBe('POST')
    expect(header(call!, 'Authorization')).toBeUndefined()
    expect(JSON.parse(call!.init.body as string)).toEqual({
      code: 'ABCDEFGH',
      name: 'Chrome',
      platform: 'chrome_extension',
      clientVersion: '0.4.0',
    })
  })

  it('client_version_header_matches_the_server_gate_format', async () => {
    const fake = fakeFetch(() => json(200, { revision: 0, ruleSet: null }))
    await client(fake.fetch, '1.2.3.4').getRuleSet(TOKEN, null)
    expect(header(fake.calls[0]!, 'X-Client-Version')).toMatch(
      /^chrome_extension\/[0-9]+\.[0-9]+\.[0-9]+$/
    )
    expect(header(fake.calls[0]!, 'X-Client-Version')).toBe('chrome_extension/1.2.3')
  })

  it('requests_never_follow_redirects_nor_send_cookies', async () => {
    const fake = fakeFetch(() => json(200, { revision: 0, ruleSet: null }))
    await client(fake.fetch).getRuleSet(TOKEN, null)
    expect(fake.calls[0]?.init).toMatchObject({ redirect: 'error', credentials: 'omit' })
    expect(header(fake.calls[0]!, 'Authorization')).toBe(`Bearer ${TOKEN}`)
  })

  it('wrong_enrollment_code_throws_its_reason_code', async () => {
    const fake = fakeFetch(() => json(400, { code: 'invalid_enrollment_code' }))
    await expect(client(fake.fetch).enroll('ABCDEFGH', 'Chrome')).rejects.toEqual(
      new ServerError(400, 'invalid_enrollment_code')
    )
  })

  it('heartbeat_sends_the_applied_revision_and_reads_rules_version', async () => {
    const fake = fakeFetch(() =>
      json(200, {
        serverTime: '2026-11-01T10:00:00Z',
        timeToken: 'v4.public.a.b',
        keysEtag: 'k',
        rulesVersion: 5,
        tokenRotationDue: false,
      })
    )
    const answer = await client(fake.fetch).heartbeat(TOKEN, {
      clientTime: '2026-11-01T10:00:00Z',
      protectionActive: true,
      rulesHash: 'h'.repeat(43),
      policyHash: 'h'.repeat(43),
      nonce: 'n'.repeat(22),
      boot: 'boot-1',
      pinnedKids: { unlock: [KID_U], policy: [KID_P] },
      ruleSetRevision: 4,
    })
    expect(answer).toEqual({ rulesVersion: 5, tokenRotationDue: false })
    const body = JSON.parse(fake.calls[0]!.init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({ ruleSetRevision: 4, clientVersion: '0.4.0' })
  })

  it('matching_if_none_match_reads_as_not_modified', async () => {
    const fake = fakeFetch(() => new Response(null, { status: 304, headers: { ETag: '"3"' } }))
    expect(await client(fake.fetch).getRuleSet(TOKEN, 3)).toEqual({ kind: 'not_modified' })
    expect(header(fake.calls[0]!, 'If-None-Match')).toBe('"3"')
  })

  it('put_sends_if_match_and_reads_the_new_revision', async () => {
    const fake = fakeFetch(() => json(200, { revision: 4 }, { ETag: '"4"' }))
    const result = await client(fake.fetch).putRuleSet(TOKEN, { rules: [] }, 3)
    expect(result).toEqual({ kind: 'saved', revision: 4 })
    expect(fake.calls[0]?.init.method).toBe('PUT')
    expect(header(fake.calls[0]!, 'If-Match')).toBe('"3"')
    expect(JSON.parse(fake.calls[0]!.init.body as string)).toEqual({ ruleSet: { rules: [] } })
  })

  it('stale_if_match_reads_as_a_conflict_with_the_current_revision', async () => {
    const fake = fakeFetch(() => json(412, { code: 'revision_mismatch', revision: 7 }))
    expect(await client(fake.fetch).putRuleSet(TOKEN, {}, 3)).toEqual({
      kind: 'conflict',
      revision: 7,
    })
  })

  it('validation_failure_reads_as_refused', async () => {
    const fake = fakeFetch(() => json(422, { code: 'validation_failed', fields: {} }))
    expect(await client(fake.fetch).putRuleSet(TOKEN, {}, 3)).toEqual({ kind: 'refused' })
  })

  it('upgrade_required_throws_its_reason_code', async () => {
    const fake = fakeFetch(() => json(426, { code: 'client_upgrade_required' }))
    await expect(client(fake.fetch).getRuleSet(TOKEN, null)).rejects.toMatchObject({
      status: 426,
      code: 'client_upgrade_required',
    })
  })
})

describe('serverOrigin', () => {
  it('keeps_only_the_https_origin', () => {
    expect(serverOrigin(' https://focus.example.org/dashboard?x=1 ')).toBe(ORIGIN)
  })

  it('refuses_plain_http_except_on_loopback', () => {
    expect(serverOrigin('http://focus.example.org')).toBeNull()
    expect(serverOrigin('http://localhost:3333')).toBe('http://localhost:3333')
  })

  it('refuses_credentials_and_garbage', () => {
    const withCredentials = new URL(ORIGIN)
    withCredentials.username = 'name'
    withCredentials.password = 'secret'
    expect(serverOrigin(withCredentials.href)).toBeNull()
    expect(serverOrigin('not a url')).toBeNull()
  })

  it('host_permission_names_only_the_typed_host', () => {
    expect(originPermission('http://localhost:3333')).toBe('http://localhost/*')
    expect(originPermission(ORIGIN)).toBe('https://focus.example.org/*')
  })
})
