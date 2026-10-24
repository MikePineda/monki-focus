// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Conventional Commits with a DCO sign-off, enforced locally (lefthook
 * commit-msg) and in CI on pull requests. release-please derives each
 * component's version bump and changelog from these messages:
 *   feat -> minor, fix -> patch, `!` or BREAKING CHANGE -> major (minor while 0.x).
 * `security` is an extra type for security fixes.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  // Dependabot writes sentence-case subjects and cannot be configured
  // otherwise; its commits are signed off by the bot.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'security',
        'style',
        'test',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'rules',
        'engine',
        'protocol',
        'design-tokens',
        'extension',
        'android',
        'macos',
        'server',
        'web',
        'e2e',
        'ci',
        'deps',
        'docs',
        'repo',
        'security',
      ],
    ],
    // Developer Certificate of Origin (https://developercertificate.org):
    // every commit carries a `Signed-off-by:` trailer (`git commit -s`).
    // `trailer-exists` instead of the stricter `signed-off-by` rule, which
    // demands that sign-off be the very last line and so rejects a
    // `Co-Authored-By:` trailer placed after it.
    'trailer-exists': [2, 'always', 'Signed-off-by:'],
    // Long URLs and trailers (Co-Authored-By) must not fail the lint.
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
  },
}
