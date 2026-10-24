// SPDX-License-Identifier: AGPL-3.0-or-later
import js from '@eslint/js'
import type { Linter } from 'eslint'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

/** The engine runs in a Chromium service worker and in Node: no clock, no browser or Node APIs. */
const PURITY_RULES: Linter.RulesRecord = {
  'no-restricted-globals': [
    'error',
    { name: 'chrome', message: 'The engine is pure: adapters talk to chrome.*.' },
    { name: 'process', message: 'The engine is pure: no Node globals.' },
    { name: 'window', message: 'The engine is pure: no DOM globals.' },
    { name: 'document', message: 'The engine is pure: no DOM globals.' },
    { name: 'fetch', message: 'The engine is pure: no I/O.' },
    { name: 'setTimeout', message: 'The engine is pure: time is a parameter.' },
    { name: 'setInterval', message: 'The engine is pure: time is a parameter.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
      message: 'The engine is pure: `now` is a parameter.',
    },
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'The engine is pure: `now` is a parameter.',
    },
    {
      selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
      message: 'The engine is pure: `now` is a parameter.',
    },
    {
      selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
      message: 'The engine is deterministic.',
    },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: ['node:*'], message: 'The engine is pure: no Node APIs in src/.' },
        {
          group: ['@monki-focus/rules', '@monki-focus/rules/*'],
          allowTypeImports: true,
          message: 'src/ may only import types from @monki-focus/rules (its runtime reads files).',
        },
      ],
    },
  ],
}

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
  { files: ['src/**/*.ts'], rules: PURITY_RULES }
)
