// SPDX-License-Identifier: AGPL-3.0-or-later
import { request } from 'node:https'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  hostResolverRules,
  siteForHost,
  startFixtureServer,
  type FixtureServer,
} from '../../../e2e/support/fixtureServer'

function get(port: number, host: string, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, headers: { host }, rejectUnauthorized: false },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => (body += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

describe('siteForHost', () => {
  it('site_hosts_and_their_subdomains_resolve_to_the_site', () => {
    expect(siteForHost('www.reddit.com')).toBe('reddit')
    expect(siteForHost('new.reddit.com:443')).toBe('reddit')
    expect(siteForHost('twitter.com')).toBe('x')
    expect(siteForHost('www.youtube.com')).toBe('youtube')
    expect(siteForHost('m.youtube.com')).toBe('youtube-mobile')
  })

  it('lookalike_hosts_do_not_resolve_to_a_site', () => {
    expect(siteForHost('notreddit.com')).toBeUndefined()
    expect(siteForHost('reddit.com.example.org')).toBeUndefined()
    expect(siteForHost(undefined)).toBeUndefined()
  })
})

describe('hostResolverRules', () => {
  it('host_resolver_rules_map_every_site_to_the_fixture_port_and_block_the_rest', () => {
    const rules = hostResolverRules(8443).split(', ')

    expect(rules).toContain('MAP reddit.com 127.0.0.1:8443')
    expect(rules).toContain('MAP *.youtube.com 127.0.0.1:8443')
    expect(rules).toContain('MAP *.instagram.com 127.0.0.1:8443')
    expect(rules).toContain('MAP x.com 127.0.0.1:8443')
    expect(rules.at(-1)).toBe('MAP * ~NOTFOUND')
  })
})

describe('startFixtureServer', () => {
  let server: FixtureServer

  beforeAll(async () => {
    server = await startFixtureServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('fixture_server_serves_the_site_page_for_the_requested_host', async () => {
    const response = await get(server.port, 'www.reddit.com', '/')

    expect(response.status).toBe(200)
    expect(response.body).toContain('data-fixture="reddit-home"')
  })

  it('fixture_server_never_serves_files_outside_the_site_folder', async () => {
    // Encoded slashes survive URL normalisation; this points at an existing
    // HTML file four levels up (src/entrypoints/popup/index.html).
    const escape = '/..%2f..%2f..%2f..%2fsrc%2fentrypoints%2fpopup%2findex'

    expect((await get(server.port, 'www.reddit.com', escape)).status).toBe(404)
  })

  it('fixture_server_answers_404_for_unknown_hosts', async () => {
    expect((await get(server.port, 'example.com', '/')).status).toBe(404)
  })
})
