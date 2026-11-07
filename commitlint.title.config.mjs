// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Pull request titles: every rule of the commit config except the sign-off,
 * because a title is a single line and has no trailers.
 */
import base from './commitlint.config.mjs'

export default {
  ...base,
  rules: {
    ...base.rules,
    'trailer-exists': [0],
  },
}
