// SPDX-License-Identifier: AGPL-3.0-or-later

/** The slice of `fetch` the client uses (a fake in tests). */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** A device API error: the HTTP status and the contract's reason code, never text. */
export class ServerError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`server answered ${status} ${code}`)
    this.name = 'ServerError'
  }
}

export interface PinnedKids {
  unlock: string[]
  policy: string[]
}

export interface Enrollment {
  deviceUuid: string
  token: string
  pinnedKids: PinnedKids
}

/** The `HeartbeatRequest` members this client fills. */
export interface HeartbeatBody {
  clientTime: string
  protectionActive: boolean
  rulesHash: string
  policyHash: string
  nonce: string
  boot: string
  pinnedKids: PinnedKids
  ruleSetRevision: number
}

export interface HeartbeatAnswer {
  rulesVersion: number
  tokenRotationDue: boolean
}

export type RuleSetRead =
  { kind: 'fetched'; revision: number; ruleSet: unknown } | { kind: 'not_modified' }

export type RuleSetWriteResult =
  { kind: 'saved'; revision: number } | { kind: 'conflict'; revision: number } | { kind: 'refused' }

export interface ServerClientOptions {
  /** The origin the user typed, already checked by `serverOrigin`. */
  origin: string
  fetch: FetchLike
  /** The manifest version (`<semver>`), sent as `chrome_extension/<version>`. */
  extensionVersion: string
}

const API = '/api/v1'
const MAX_KIDS = 2

/**
 * Thin adapter over the device API (packages/protocol/openapi.yaml). Every
 * request goes to the one origin the user typed, never follows a redirect
 * (the token must not leak to another origin), sends no cookie and carries
 * `X-Client-Version: chrome_extension/<semver>`. Nothing here logs.
 */
export class ServerClient {
  constructor(private readonly options: ServerClientOptions) {}

  async enroll(code: string, name: string): Promise<Enrollment> {
    const response = await this.request('POST', '/device/enroll', null, {
      body: { code, name, platform: 'chrome_extension', clientVersion: this.version() },
    })
    if (response.status !== 201) throw await errorOf(response)
    const body = (await response.json()) as {
      deviceUuid: string
      token: string
      keys: { keys: { kid: string; purpose: string }[] }
    }
    return {
      deviceUuid: body.deviceUuid,
      token: body.token,
      pinnedKids: {
        unlock: kidsFor(body.keys.keys, 'unlock'),
        policy: kidsFor(body.keys.keys, 'policy'),
      },
    }
  }

  async heartbeat(token: string, body: HeartbeatBody): Promise<HeartbeatAnswer> {
    const response = await this.request('POST', '/device/heartbeat', token, {
      body: { ...body, clientVersion: this.version() },
    })
    if (response.status !== 200) throw await errorOf(response)
    const answer = (await response.json()) as HeartbeatAnswer
    return { rulesVersion: answer.rulesVersion, tokenRotationDue: answer.tokenRotationDue }
  }

  async getRuleSet(token: string, ifNoneMatch: number | null): Promise<RuleSetRead> {
    const headers: Record<string, string> = {}
    if (ifNoneMatch !== null) headers['If-None-Match'] = `"${ifNoneMatch}"`
    const response = await this.request('GET', '/device/rule-set', token, { headers })
    if (response.status === 304) return { kind: 'not_modified' }
    if (response.status !== 200) throw await errorOf(response)
    const body = (await response.json()) as { revision: number; ruleSet: unknown }
    return { kind: 'fetched', revision: body.revision, ruleSet: body.ruleSet }
  }

  async putRuleSet(token: string, ruleSet: unknown, ifMatch: number): Promise<RuleSetWriteResult> {
    const response = await this.request('PUT', '/device/rule-set', token, {
      headers: { 'If-Match': `"${ifMatch}"` },
      body: { ruleSet },
    })
    if (response.status === 200) {
      return { kind: 'saved', revision: ((await response.json()) as { revision: number }).revision }
    }
    if (response.status === 412) {
      return {
        kind: 'conflict',
        revision: ((await response.json()) as { revision: number }).revision,
      }
    }
    if (response.status === 422) return { kind: 'refused' }
    throw await errorOf(response)
  }

  private version(): string {
    return semanticVersionOf(this.options.extensionVersion)
  }

  private request(
    method: string,
    path: string,
    token: string | null,
    { headers = {}, body }: { headers?: Record<string, string>; body?: unknown }
  ): Promise<Response> {
    const all: Record<string, string> = {
      'Accept': 'application/json',
      'X-Client-Version': `chrome_extension/${this.version()}`,
      ...headers,
    }
    if (token !== null) all.Authorization = `Bearer ${token}`
    if (body !== undefined) all['Content-Type'] = 'application/json'
    const init: RequestInit = {
      method,
      headers: all,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    return this.options.fetch(`${this.options.origin}${API}${path}`, init)
  }
}

/**
 * Chrome manifest versions have one to four numeric parts; the server's
 * gate wants exactly `<major>.<minor>.<patch>`.
 */
function semanticVersionOf(manifestVersion: string): string {
  const parts = manifestVersion.split('.').filter((part) => /^\d+$/.test(part))
  while (parts.length < 3) parts.push('0')
  return parts
    .slice(0, 3)
    .map((part) => String(Number(part)))
    .join('.')
}

function kidsFor(keys: { kid: string; purpose: string }[], purpose: string): string[] {
  return keys
    .filter((key) => key.purpose === purpose)
    .map((key) => key.kid)
    .slice(0, MAX_KIDS)
}

async function errorOf(response: Response): Promise<ServerError> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return new ServerError(response.status, typeof body.code === 'string' ? body.code : 'unknown')
  } catch {
    return new ServerError(response.status, 'unknown')
  }
}
