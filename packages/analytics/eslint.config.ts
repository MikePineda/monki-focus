// SPDX-License-Identifier: AGPL-3.0-or-later
import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // The analytics core is pure: no implicit clock, no I/O, no Node-only APIs,
    // and @monki-focus/rules is types only: rules data reaches src/ through the
    // engine's RulesCatalog, which adapters build from @monki-focus/rules/pure.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'src/ must run in a service worker: no Node APIs.' },
            {
              group: ['@monki-focus/rules', '@monki-focus/rules/*'],
              allowTypeImports: true,
              message: 'Only type imports: rules data comes in through the RulesCatalog.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'No Node globals in src/.' },
        { name: 'Buffer', message: 'No Node globals in src/.' },
        { name: 'require', message: 'No Node globals in src/.' },
        { name: 'fetch', message: 'No I/O in src/.' },
        { name: 'performance', message: 'Take the clock as a parameter.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Take the clock as a parameter: no Date.now().',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Take the clock as a parameter: no new Date().',
        },
      ],
    },
  }
)
