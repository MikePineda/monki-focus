// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { packageRoot } from '../../src/PackageRoot.ts'
import {
  KNOWN_ATTRIBUTES,
  TEXT_ATTRIBUTES,
  findUnsanitized,
  loadAllowlist,
  sanitizeUidump,
} from '../../scripts/sanitize-uidump.mjs'

const script = join(packageRoot, 'scripts', 'sanitize-uidump.mjs')
const dumpsRoot = join(packageRoot, 'fixtures', 'detectors', 'android')

/** A capture as a device would produce it (synthetic values standing in for personal ones). */
const capture = [
  "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>",
  '<hierarchy rotation="0">',
  '  <node index="0" text="Private caption &amp; more" resource-id="com.example.feed:id/caption" class="android.widget.TextView" package="com.example.feed" content-desc="Sender Placeholder" hint="Write a reply" bounds="[0,0][1080,200]">',
  '    <node index="0" text="" resource-id="com.example.feed:id/tab" class="android.widget.FrameLayout" package="com.example.feed" content-desc="Reels" selected="true" bounds="[0,200][540,400]" />',
  '    <node index="1" text="https://www.example.com/r/sample" resource-id="com.example.feed:id/url_bar" class="android.widget.EditText" package="com.example.feed" content-desc="" bounds="[0,400][1080,500]" />',
  '    <node index="2" text="https://social.invalid/someone" resource-id="com.example.feed:id/url_bar" class="android.widget.EditText" package="com.example.feed" content-desc="Custom Label" bounds="[0,500][1080,600]" />',
  '  </node>',
  '</hierarchy>',
].join('\n')

function dumpFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return dumpFiles(path)
    return entry.endsWith('.xml') ? [path] : []
  })
}

describe('sanitize-uidump', () => {
  it('replaces_every_text_and_content_desc_with_the_placeholder', () => {
    const out = sanitizeUidump(capture)

    expect(out).not.toContain('Private caption')
    expect(out).not.toContain('Sender Placeholder')
    expect(out).not.toContain('Write a reply')
    expect(out).not.toContain('social.invalid')
    expect(out).toContain('text="⟨t⟩" resource-id="com.example.feed:id/caption"')
  })

  it('keeps_view_ids_classes_bounds_and_flags', () => {
    const out = sanitizeUidump(capture)

    expect(out).toContain('resource-id="com.example.feed:id/tab"')
    expect(out).toContain('class="android.widget.FrameLayout"')
    expect(out).toContain('selected="true"')
    expect(out).toContain('bounds="[0,200][540,400]"')
  })

  it('keeps_allowlisted_labels_and_example_host_urls', () => {
    const out = sanitizeUidump(capture)

    expect(out).toContain('content-desc="Reels"')
    expect(out).toContain('text="https://www.example.com/r/sample"')
  })

  it('keep_option_adds_labels_for_one_run', () => {
    expect(sanitizeUidump(capture, { keep: ['Custom Label'] })).toContain(
      'content-desc="Custom Label"'
    )
    expect(sanitizeUidump(capture)).not.toContain('Custom Label')
  })

  it('marks_the_root_and_is_idempotent', () => {
    const once = sanitizeUidump(capture)

    expect(once).toContain('<hierarchy rotation="0" monki-sanitized="1">')
    expect(sanitizeUidump(once)).toBe(once)
    expect(findUnsanitized(once)).toEqual([])
  })

  it('replaces_every_text_bearing_attribute', () => {
    const attributes = TEXT_ATTRIBUTES.map((name) => `${name}="Personal ${name}"`).join(' ')
    const dump = `<hierarchy rotation="0"><node index="0" ${attributes} bounds="[0,0][1,1]" /></hierarchy>`

    const out = sanitizeUidump(dump)

    expect(out).not.toContain('Personal')
    for (const name of TEXT_ATTRIBUTES) expect(out).toContain(`${name}="⟨t⟩"`)
  })

  it('drops_unknown_attributes_and_empties_odd_identifiers', () => {
    const dump =
      '<hierarchy rotation="0"><node index="0" user-name="Someone" resource-id="com.example:id/a b" bounds="[0,0][1,1]" /></hierarchy>'

    const out = sanitizeUidump(dump)

    expect(out).not.toContain('Someone')
    expect(out).not.toContain('user-name')
    expect(out).toContain('resource-id=""')
    expect(findUnsanitized(out)).toEqual([])
  })

  it('check_reports_unsanitised_dumps_without_printing_values', () => {
    const problems = findUnsanitized(capture)

    expect(problems).toContain('line 2: missing monki-sanitized="1" on <hierarchy>')
    expect(problems.some((problem) => problem.includes('unsanitised text'))).toBe(true)
    expect(problems.some((problem) => problem.includes('unsanitised hint'))).toBe(true)
    expect(problems.join('\n')).not.toContain('Private caption')
  })

  it('check_flags_unknown_attributes_and_comments', () => {
    const sneaky = sanitizeUidump(capture)
      .replace('<node index="0"', '<node secret="x" index="0"')
      .replace('</hierarchy>', '<!-- a note --></hierarchy>')

    const problems = findUnsanitized(sneaky)

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/unknown attribute secret/),
        expect.stringMatching(/comment not allowed/),
      ])
    )
  })

  it.each([
    [
      'element text',
      '<hierarchy rotation="0">leak<node index="0" bounds="[0,0][1,1]" /></hierarchy>',
    ],
    ['CDATA', '<hierarchy rotation="0"><![CDATA[leak]]></hierarchy>'],
    ['DOCTYPE', '<!DOCTYPE hierarchy [<!ENTITY x "y">]><hierarchy rotation="0"></hierarchy>'],
    [
      'an unknown entity',
      '<hierarchy rotation="0"><node text="&x;" bounds="[0,0][1,1]" /></hierarchy>',
    ],
    ['a processing instruction', '<hierarchy rotation="0"><?php echo 1 ?></hierarchy>'],
    ['an unknown element', '<hierarchy rotation="0"><script /></hierarchy>'],
    ['unbalanced tags', '<hierarchy rotation="0"><node index="0"></hierarchy>'],
  ])('the_tokenizer_refuses_%s', (_name, dump) => {
    expect(() => sanitizeUidump(dump)).toThrow(SyntaxError)
    expect(findUnsanitized(dump)).toHaveLength(1)
    expect(findUnsanitized(dump).join('')).not.toContain('leak')
  })

  it('cli_sanitises_a_file_and_check_mode_passes_on_the_result', () => {
    const directory = mkdtempSync(join(tmpdir(), 'uidump-'))
    const input = join(directory, 'in.xml')
    const output = join(directory, 'out.xml')
    writeFileSync(input, capture)

    execFileSync(process.execPath, [script, input, output, '--keep', 'Custom Label'])

    expect(readFileSync(output, 'utf8')).toContain('content-desc="Custom Label"')
    expect(() =>
      execFileSync(process.execPath, [script, '--check', input], { stdio: 'pipe' })
    ).toThrow()
  })

  it('the_committed_allowlist_names_the_same_attributes_as_the_sanitiser', () => {
    const json = JSON.parse(readFileSync(join(dumpsRoot, 'label-allowlist.json'), 'utf8')) as {
      textAttributes: string[]
      knownAttributes: { hierarchy: string[]; node: string[] }
    }

    expect(json.textAttributes).toEqual([...TEXT_ATTRIBUTES])
    expect([...json.knownAttributes.node].sort()).toEqual([...KNOWN_ATTRIBUTES.node].sort())
    expect([...json.knownAttributes.hierarchy].sort()).toEqual(
      [...KNOWN_ATTRIBUTES.hierarchy].sort()
    )
  })

  it('allowlist_holds_only_generic_labels', () => {
    const allowlist = loadAllowlist()

    expect(allowlist.placeholder).toBe('⟨t⟩')
    expect(allowlist.placeholderHosts.every((host) => /^example\.(com|net|org)$/.test(host))).toBe(
      true
    )
  })

  it.each(dumpFiles(dumpsRoot).map((path) => [relative(dumpsRoot, path), path] as const))(
    'uidump_fixtures_are_sanitized %s',
    (_name, path) => {
      expect(findUnsanitized(readFileSync(path, 'utf8'))).toEqual([])
    }
  )

  it('every_uidump_fixture_has_an_expectation', () => {
    for (const path of dumpFiles(dumpsRoot)) {
      const expectation = JSON.parse(
        readFileSync(path.replace(/\.xml$/, '.expect.json'), 'utf8')
      ) as Record<string, unknown>
      expect(expectation.device, path).toBe('generic')
      expect(relative(dumpsRoot, path)).toMatch(/^[a-z][a-z0-9_.]*\/[^/]+\/[a-z_]+-\d{2}\.xml$/)
    }
  })
})
