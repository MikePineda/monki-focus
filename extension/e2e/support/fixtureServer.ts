// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate } from 'selfsigned'

/** Site id (folder under `e2e/fixtures/sites`) -> hosts it answers for. */
export const FIXTURE_SITES = {
  'reddit': ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
  'x': ['x.com', 'twitter.com'],
  'youtube': ['youtube.com', 'www.youtube.com'],
  // The mobile site has its own DOM (`ytm-*`), so its own fixture folder.
  'youtube-mobile': ['m.youtube.com'],
  'instagram': ['instagram.com', 'www.instagram.com'],
} as const

export type FixtureSite = keyof typeof FIXTURE_SITES

export const DEFAULT_FIXTURES_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/sites'
)

export interface FixtureServer {
  /** The loopback port the HTTPS server listens on. */
  port: number
  close(): Promise<void>
}

export interface FixtureServerOptions {
  root?: string
  /** 0 (default) picks a free ephemeral port, so parallel workers never clash. */
  port?: number
}

export function siteForHost(host: string | undefined): FixtureSite | undefined {
  const hostname = (host ?? '').split(':')[0]?.toLowerCase() ?? ''
  // An exact host wins over a parent domain (`m.youtube.com` over `youtube.com`).
  for (const [site, hosts] of Object.entries(FIXTURE_SITES)) {
    if ((hosts as readonly string[]).includes(hostname)) return site as FixtureSite
  }
  for (const [site, hosts] of Object.entries(FIXTURE_SITES)) {
    if (hosts.some((candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`))) {
      return site as FixtureSite
    }
  }
  return undefined
}

/**
 * Candidate files for a request path, static-hosting style:
 * `/` -> `index.html`; `/r/sub/` -> `r/sub/index.html`, `r/sub.html`.
 */
function candidateFiles(pathname: string): string[] {
  const trimmed = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '')
  if (trimmed === '') return ['index.html']
  return [join(trimmed, 'index.html'), `${trimmed}.html`]
}

async function findFixture(siteDir: string, pathname: string): Promise<string | undefined> {
  for (const candidate of candidateFiles(pathname)) {
    const file = resolve(siteDir, normalize(candidate))
    // Never serve anything outside the site's fixture folder.
    if (!file.startsWith(siteDir + sep)) return undefined
    const info = await stat(file).catch(() => undefined)
    if (info?.isFile()) return file
  }
  return undefined
}

/**
 * Local HTTPS server that stands in for the real sites in E2E. Chromium is
 * started with `--host-resolver-rules` mapping every site host to
 * `127.0.0.1:<port>` (see `hostResolverRules`), so pages keep their real
 * origin (`https://www.reddit.com/`) and the extension's host permissions and
 * content-script matches apply unchanged. The certificate is self-signed and
 * generated per run; Chromium runs with `--ignore-certificate-errors`.
 */
export async function startFixtureServer(
  options: FixtureServerOptions = {}
): Promise<FixtureServer> {
  const root = resolve(options.root ?? DEFAULT_FIXTURES_ROOT)
  const hosts = Object.values(FIXTURE_SITES).flat()
  const pems = await generate([{ name: 'commonName', value: 'monki-focus-fixtures' }], {
    keyType: 'ec',
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames: hosts.map((value) => ({ type: 2, value })) }],
  })

  const server: Server = createServer(
    { key: pems.private, cert: pems.cert },
    (request, response) => {
      void (async () => {
        const site = siteForHost(request.headers.host)
        const pathname = new URL(request.url ?? '/', 'https://fixture.invalid').pathname
        const file = site ? await findFixture(join(root, site), pathname) : undefined
        if (!file) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          response.end('fixture not found')
          return
        }
        response.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        })
        response.end(await readFile(file))
      })().catch(() => {
        response.writeHead(500)
        response.end()
      })
    }
  )

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(options.port ?? 0, '127.0.0.1', () => resolveListen())
  })

  return {
    port: (server.address() as AddressInfo).port,
    close: () =>
      new Promise<void>((resolveClose) => {
        server.closeAllConnections()
        server.close(() => resolveClose())
      }),
  }
}

/**
 * `--host-resolver-rules` value: every fixture host (and its subdomains) goes
 * to the fixture server; any other host fails to resolve, so a test can never
 * reach the real internet by accident.
 */
export function hostResolverRules(port: number): string {
  const domains = [...new Set(Object.values(FIXTURE_SITES).flat())].filter(
    (host) => host.split('.').length === 2
  )
  const rules = domains.flatMap((domain) => [
    `MAP ${domain} 127.0.0.1:${port}`,
    `MAP *.${domain} 127.0.0.1:${port}`,
  ])
  return [...rules, 'MAP * ~NOTFOUND'].join(', ')
}
