// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { packageRoot } from '../../src/PackageRoot.ts'
import { findUnsanitized, loadAllowlist, sanitizeUidump } from '../../scripts/sanitize-uidump.mjs'

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

    expect(once).toContain('<hierarchy monki-sanitized="1" rotation="0">')
    expect(sanitizeUidump(once)).toBe(once)
    expect(findUnsanitized(once)).toEqual([])
  })

  it('check_reports_unsanitised_dumps_without_printing_values', () => {
    const problems = findUnsanitized(capture)

    expect(problems).toContain('missing monki-sanitized="1" on <hierarchy>')
    expect(problems.some((problem) => problem.includes('unsanitised text'))).toBe(true)
    expect(problems.join('\n')).not.toContain('Private caption')
  })

  it('check_rejects_comments_and_element_text', () => {
    const sneaky = sanitizeUidump(capture).replace(
      '</hierarchy>',
      '<!-- a note -->leak</hierarchy>'
    )

    expect(findUnsanitized(sneaky)).toEqual([
      expect.stringMatching(/comment not allowed/),
      expect.stringMatching(/element text/),
    ])
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
