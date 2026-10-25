// SPDX-License-Identifier: AGPL-3.0-or-later
import { configApp } from '@adonisjs/eslint-config'

export default configApp(
  { ignores: ['build/**', '.adonisjs/**', 'tmp/**'] },
  {
    // app/domain is pure: no framework, no database, no HTTP, no file
    // system. Services pass plain values (and the clock's `now`) in.
    // tests/unit/architecture.spec.ts enforces the same rule on every file.
    files: ['app/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // A regex: in gitignore-style `group` patterns a leading `#` is a comment.
              regex:
                '^(#(models|services|controllers|middleware|database|start|config|providers|scheduler|http|logging|exceptions)/|@adonisjs/|@vinejs/|pg$|knex$|luxon$|node:(fs|net|http|https|child_process|dgram|dns|tls))',
              message: 'app/domain is pure: pass plain values in instead of importing I/O.',
            },
          ],
        },
      ],
    },
  }
)
