// SPDX-License-Identifier: AGPL-3.0-or-later
/** A GitHub-flavoured Markdown table (prettier aligns it afterwards). */
export function markdownTable(
  header: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell) => cell.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')).join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n')
}

/** Inline code. */
export const code = (text: string): string => `\`${text}\``
