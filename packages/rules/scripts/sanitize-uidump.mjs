#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sanitises an Android UI dump (`uiautomator dump`, or the debug capture of
// the app, same XML) before it is committed as a detector fixture
// (plan §5.2).
//
// The dump is read by a small strict tokenizer: only the XML declaration,
// comments, `<hierarchy>` and `<node>` elements with the known uiautomator
// attributes are accepted; CDATA, DOCTYPE, processing instructions, unknown
// entities and element text are errors. Every text-bearing attribute
// (`text`, `content-desc`, `hint`, `tooltip-text`, `pane-title`,
// `state-description`, `error`, `container-title`) becomes the placeholder
// unless it is empty, an allowlisted UI label or a URL on a reserved example
// host. Unknown attributes and comments are dropped; identifier attributes
// with unexpected characters are emptied. The root gets `monki-sanitized="1"`.
//
//   node packages/rules/scripts/sanitize-uidump.mjs in.xml out.xml --keep "Reels,Shorts"
//   node packages/rules/scripts/sanitize-uidump.mjs --check fixtures/detectors/android/*/*/*.xml
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
  'error',
  'container-title',
]

const FLAG = /^(true|false)$/
const NUMBER = /^-?[0-9]{1,6}$/
const IDENTIFIER = /^[A-Za-z0-9_.$:/-]*$/

/** Every attribute a sanitised dump may carry, with the shape of its value. */
const NODE_ATTRIBUTES = {
  'index': NUMBER,
  'resource-id': IDENTIFIER,
  'class': IDENTIFIER,
  'package': IDENTIFIER,
  'checkable': FLAG,
  'checked': FLAG,
  'clickable': FLAG,
  'enabled': FLAG,
  'focusable': FLAG,
  'focused': FLAG,
  'scrollable': FLAG,
  'long-clickable': FLAG,
  'password': FLAG,
  'selected': FLAG,
  'visible-to-user': FLAG,
  'important-for-accessibility': FLAG,
  'drawing-order': NUMBER,
  'display-id': NUMBER,
  'bounds': /^\[-?[0-9]+,-?[0-9]+\]\[-?[0-9]+,-?[0-9]+\]$/,
}

const HIERARCHY_ATTRIBUTES = {
  'rotation': NUMBER,
  'monki-sanitized': /^1$/,
}

/** Attribute names per element, besides the text-bearing ones (mirrored in label-allowlist.json). */
export const KNOWN_ATTRIBUTES = {
  hierarchy: Object.keys(HIERARCHY_ATTRIBUTES),
  node: Object.keys(NODE_ATTRIBUTES),
}

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

function decodeEntities(value, line) {
  return value.replace(/&([^;&]*);?/g, (whole, name) => {
    if (!whole.endsWith(';')) throw new SyntaxError(`line ${line}: bare &`)
    if (/^#x[0-9a-fA-F]{1,6}$/.test(name))
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16))
    if (/^#[0-9]{1,7}$/.test(name)) return String.fromCodePoint(Number.parseInt(name.slice(1), 10))
    if (name in ENTITIES) return ENTITIES[name]
    throw new SyntaxError(`line ${line}: unknown entity`)
  })
}

function encodeAttribute(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Tokenises a dump into declaration, comment, open, close and whitespace
 * tokens. Throws a SyntaxError (line only, never content) on anything else.
 */
export function tokenize(xml) {
  const tokens = []
  let position = 0
  let line = 1
  const advance = (text) => {
    line += text.split('\n').length - 1
    position += text.length
  }
  while (position < xml.length) {
    const rest = xml.slice(position)
    const space = /^\s+/.exec(rest)
    if (space) {
      advance(space[0])
      continue
    }
    if (rest.startsWith('<?')) {
      const declaration = /^<\?xml(\s+[a-z]+=('[^']*'|"[^"]*"))*\s*\?>/.exec(rest)
      if (!declaration || tokens.length > 0)
        throw new SyntaxError(`line ${line}: processing instruction`)
      tokens.push({ type: 'declaration', raw: declaration[0], line })
      advance(declaration[0])
      continue
    }
    if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->')
      if (end === -1) throw new SyntaxError(`line ${line}: unterminated comment`)
      const body = rest.slice(4, end)
      if (body.includes('--')) throw new SyntaxError(`line ${line}: malformed comment`)
      tokens.push({ type: 'comment', body: body.trim(), line })
      advance(rest.slice(0, end + 3))
      continue
    }
    if (rest.startsWith('<!')) throw new SyntaxError(`line ${line}: DOCTYPE or CDATA`)
    const close = /^<\/([a-z]+)\s*>/.exec(rest)
    if (close) {
      tokens.push({ type: 'close', name: close[1], line })
      advance(close[0])
      continue
    }
    const open = /^<([a-z]+)((?:\s+[a-z][a-z-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/.exec(rest)
    if (open) {
      const attributes = []
      for (const match of (open[2] ?? '').matchAll(
        /([a-z][a-z-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g
      )) {
        const name = match[1] ?? ''
        if (attributes.some((attribute) => attribute.name === name)) {
          throw new SyntaxError(`line ${line}: duplicate attribute ${name}`)
        }
        attributes.push({ name, value: decodeEntities(match[2] ?? match[3] ?? '', line) })
      }
      tokens.push({ type: 'open', name: open[1], attributes, selfClosing: open[3] === '/', line })
      advance(open[0])
      continue
    }
    throw new SyntaxError(`line ${line}: unexpected content`)
  }
  return tokens
}

function hostOf(value) {
  const withoutScheme = value.trim().replace(/^https?:\/\//i, '')
  const host = withoutScheme.split(/[/?#:]/, 1)[0] ?? ''
  return host.toLowerCase()
}

function isPlaceholderUrl(value, hosts) {
  if (/\s/.test(value)) return false
  const host = hostOf(value)
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
}

/** True when a decoded attribute value may stay in a committed dump. */
export function isAllowedText(value, allowlist, extraLabels = []) {
  if (value === '' || value === allowlist.placeholder) return true
  if (allowlist.labels.includes(value) || extraLabels.includes(value)) return true
  return isPlaceholderUrl(value, allowlist.placeholderHosts)
}

function schemaOf(element) {
  if (element === 'node') return NODE_ATTRIBUTES
  if (element === 'hierarchy') return HIERARCHY_ATTRIBUTES
  return null
}

/** Checks element nesting: one `<hierarchy>` root holding `<node>` elements only. */
function checkStructure(tokens) {
  const stack = []
  let roots = 0
  for (const token of tokens) {
    if (token.type === 'open') {
      if (schemaOf(token.name) === null)
        throw new SyntaxError(`line ${token.line}: unknown element`)
      if (stack.length === 0) {
        if (token.name !== 'hierarchy' || roots > 0)
          throw new SyntaxError(`line ${token.line}: root must be one <hierarchy>`)
        roots += 1
      } else if (token.name !== 'node') {
        throw new SyntaxError(`line ${token.line}: <hierarchy> nested`)
      }
      if (!token.selfClosing) stack.push(token.name)
    } else if (token.type === 'close') {
      if (stack.pop() !== token.name)
        throw new SyntaxError(`line ${token.line}: mismatched </${token.name}>`)
    }
  }
  if (stack.length > 0 || roots !== 1) throw new SyntaxError('unbalanced or missing <hierarchy>')
}

/** Returns the sanitised dump text. Throws on anything the tokenizer refuses. */
export function sanitizeUidump(xml, { keep = [], allowlist = loadAllowlist() } = {}) {
  const tokens = tokenize(xml)
  checkStructure(tokens)
  const lines = [
    "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
    `<!-- ${ALLOWED_COMMENTS[0]} -->`,
    `<!-- ${ALLOWED_COMMENTS[2]} -->`,
  ]
  let depth = 0
  for (const token of tokens) {
    if (token.type === 'close') {
      depth -= 1
      lines.push(`${'  '.repeat(depth)}</${token.name}>`)
    }
    if (token.type !== 'open') continue
    const schema = schemaOf(token.name) ?? {}
    const kept = []
    for (const { name, value } of token.attributes) {
      if (TEXT_ATTRIBUTES.includes(name) && token.name === 'node') {
        kept.push([name, isAllowedText(value, allowlist, keep) ? value : allowlist.placeholder])
      } else if (name in schema) {
        kept.push([name, schema[name].test(value) ? value : ''])
      }
    }
    if (token.name === 'hierarchy' && !kept.some(([name]) => name === 'monki-sanitized')) {
      kept.push(['monki-sanitized', '1'])
    }
    const attributes = kept.map(([name, value]) => ` ${name}="${encodeAttribute(value)}"`).join('')
    lines.push(`${'  '.repeat(depth)}<${token.name}${attributes}${token.selfClosing ? ' />' : '>'}`)
    if (!token.selfClosing) depth += 1
  }
  return `${lines.join('\n')}\n`
}

/**
 * Problems that make a dump unsafe to commit, as `line N: <reason>`. Values
 * are never included, so a leak in a fixture never reaches a CI log.
 */
export function findUnsanitized(xml, allowlist = loadAllowlist()) {
  let tokens
  try {
    tokens = tokenize(xml)
    checkStructure(tokens)
  } catch (error) {
    return [error instanceof SyntaxError ? error.message : 'unreadable dump']
  }
  const problems = []
  for (const token of tokens) {
    if (token.type === 'comment' && !ALLOWED_COMMENTS.includes(token.body)) {
      problems.push(`line ${token.line}: comment not allowed`)
    }
    if (token.type !== 'open') continue
    const schema = schemaOf(token.name) ?? {}
    for (const { name, value } of token.attributes) {
      if (TEXT_ATTRIBUTES.includes(name) && token.name === 'node') {
        if (!isAllowedText(value, allowlist))
          problems.push(`line ${token.line}: unsanitised ${name}`)
      } else if (!(name in schema)) {
        problems.push(`line ${token.line}: unknown attribute ${name}`)
      } else if (!schema[name].test(value)) {
        problems.push(`line ${token.line}: unexpected value in ${name}`)
      }
    }
    if (
      token.name === 'hierarchy' &&
      !token.attributes.some((a) => a.name === 'monki-sanitized' && a.value === '1')
    ) {
      problems.push(`line ${token.line}: missing ${SANITIZED_MARKER} on <hierarchy>`)
    }
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
  try {
    writeFileSync(output, sanitizeUidump(readFileSync(input, 'utf8'), { keep }))
  } catch (error) {
    console.error(
      `sanitize-uidump: ${error instanceof SyntaxError ? error.message : 'unreadable dump'}`
    )
    return 1
  }
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
