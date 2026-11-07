// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Dependabot pull request titles: the title rules except the subject case,
 * because Dependabot capitalises its subject (`Bump wxt from …`), and the header
 * length, because a long package name and group suffix are out of its control.
 * The commitlint workflow selects this config only for pull requests opened by
 * `dependabot[bot]`.
 */
import title from './commitlint.title.config.mjs'

export default {
  ...title,
  rules: {
    ...title.rules,
    'subject-case': [0],
    'header-max-length': [0],
  },
}
