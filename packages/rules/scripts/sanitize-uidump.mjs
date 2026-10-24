#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sanitises an Android UI dump (`uiautomator dump`, or the debug capture of
// the app, same XML) before it is committed as a detector fixture
// (plan §5.2). Every text-bearing attribute (`text`, `content-desc`, `hint`,
// …) becomes the placeholder unless it is empty, an allowlisted UI label or
// a URL on a reserved example host. View ids, classes, bounds and flags are
// kept. Comments are dropped. The root gets `monki-sanitized="1"`.
//
//   node packages/rules/scripts/sanitize-uidump.mjs in.xml out.xml --keep "Reels,Shorts"
//   node packages/rules/scripts/sanitize-uidump.mjs --check fixtures/detectors/android/**/*.xml
//
// `--check` never prints an offending value: only the file, line and attribute.
// No dependencies: Node built-ins only.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Attributes that can carry what the user sees or typed. */
export const TEXT_ATTRIBUTES = [
  'text',
  'content-desc',
  'hint',
  'tooltip-text',
  'pane-title',
  'state-description',
]

/** Comments a committed dump may carry (licence header and provenance only). */
export const ALLOWED_COMMENTS = [
  'SPDX-License-Identifier: AGPL-3.0-or-later',
  'Synthetic dump: real uiautomator structure and view ids, placeholder text only.',
  'Sanitised capture: every text replaced by the placeholder except allowlisted UI labels.',
]

export const SANITIZED_MARKER = 'monki-sanitized="1"'

/** The committed allowlist (`fixtures/detectors/android/label-allowlist.json`). */
export function loadAllowlist(
  path = join(here, '..', 'fixtures', 'detectors', 'android', 'label-allowlist.json')
) {
  const json = JSON.parse(readFileSync(path, 'utf8'))
  return {
    placeholder: json.placeholder,
    labels: [...json.labels],
    placeholderHosts: [...json.placeholderHosts],
  }
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (whole, name) => {
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
    return ENTITIES[name] ?? whole
  })
}

function hostOf(value) {
  const withoutScheme = value.trim().replace(/^https?:\/\//i, '')
  const host = withoutScheme.split(/[/?#:]/, 1)[0] ?? ''
  return host.toLowerCase()
}

function isPlaceholderUrl(value, hosts) {
  if (/\s/.test(value.trim())) return false
  const host = hostOf(value)
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

/** True when a decoded attribute value may stay in a committed dump. */
export function isAllowedText(value, allowlist, extraLabels = []) {
  if (value === '' || value === allowlist.placeholder) return true
  if (allowlist.labels.includes(value) || extraLabels.includes(value)) return true
  return isPlaceholderUrl(value, allowlist.placeholderHosts)
}

const ATTRIBUTE = new RegExp(`(\\s)(${TEXT_ATTRIBUTES.join('|')})=("([^"]*)"|'([^']*)')`, 'g')

/** Returns the sanitised dump text. */
export function sanitizeUidump(xml, { keep = [], allowlist = loadAllowlist() } = {}) {
  const withoutComments = xml.replace(/<!--[\s\S]*?-->\s*/g, '')
  const scrubbed = withoutComments.replace(ATTRIBUTE, (whole, space, name, _quoted, dq, sq) => {
    const raw = dq ?? sq ?? ''
    if (isAllowedText(decodeEntities(raw), allowlist, keep)) return whole
    return `${space}${name}="${allowlist.placeholder}"`
  })
  const marked = /<hierarchy\b[^>]*\bmonki-sanitized="1"/.test(scrubbed)
    ? scrubbed
    : scrubbed.replace(/<hierarchy\b/, `<hierarchy ${SANITIZED_MARKER}`)
  const header = `<!-- ${ALLOWED_COMMENTS[0]} -->\n<!-- ${ALLOWED_COMMENTS[2]} -->\n`
  return marked.replace(
    /^(<\?xml[^>]*\?>\s*)?/,
    (prolog) => `${prolog.trimEnd()}${prolog ? '\n' : ''}${header}`
  )
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

/**
 * Problems that make a dump unsafe to commit, as `line N: <reason>`. Values
 * are never included, so a leak in a fixture never reaches a CI log.
 */
export function findUnsanitized(xml, allowlist = loadAllowlist()) {
  const problems = []
  if (!/<hierarchy\b[^>]*\bmonki-sanitized="1"/.test(xml))
    problems.push('missing monki-sanitized="1" on <hierarchy>')
  for (const match of xml.matchAll(ATTRIBUTE)) {
    const raw = match[4] ?? match[5] ?? ''
    if (!isAllowedText(decodeEntities(raw), allowlist)) {
      problems.push(`line ${lineOf(xml, match.index)}: unsanitised ${match[2]}`)
    }
  }
  for (const match of xml.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (!ALLOWED_COMMENTS.includes((match[1] ?? '').trim())) {
      problems.push(`line ${lineOf(xml, match.index)}: comment not allowed`)
    }
  }
  for (const match of xml.matchAll(/>([^<]+)</g)) {
    if ((match[1] ?? '').trim() !== '')
      problems.push(`line ${lineOf(xml, match.index)}: element text`)
  }
  return problems
}

function main(argv) {
  if (argv[0] === '--check') {
    const files = argv.slice(1)
    let failed = 0
    for (const file of files) {
      const problems = findUnsanitized(readFileSync(file, 'utf8'))
      for (const problem of problems) console.error(`${file}: ${problem}`)
      if (problems.length > 0) failed += 1
    }
    console.log(`sanitize-uidump: ${files.length - failed}/${files.length} dumps sanitised`)
    return failed === 0 ? 0 : 1
  }
  const keepAt = argv.indexOf('--keep')
  const keep =
    keepAt === -1
      ? []
      : (argv[keepAt + 1] ?? '')
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
  const paths = argv.filter(
    (arg, index) => !arg.startsWith('--') && (keepAt === -1 || index !== keepAt + 1)
  )
  const [input, output] = paths
  if (!input || !output) {
    console.error(
      'usage: sanitize-uidump.mjs <in.xml> <out.xml> [--keep "Label,Other"] | --check <files…>'
    )
    return 2
  }
  writeFileSync(output, sanitizeUidump(readFileSync(input, 'utf8'), { keep }))
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
