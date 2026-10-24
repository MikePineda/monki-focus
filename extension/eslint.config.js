// SPDX-License-Identifier: AGPL-3.0-or-later
// @ts-check
import eslint from '@eslint/js'
import i18next from 'eslint-plugin-i18next'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'coverage/', 'playwright-report/', 'test-results/'] },
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
    ],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Untrusted page data must never reach the DOM as markup (04 §4).
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Render text through Preact; never assign markup.' },
        { property: 'outerHTML', message: 'Render text through Preact; never assign markup.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render text through Preact; never inject markup.',
        },
      ],
    },
  },
  {
    // UI copy lives only in src/i18n/catalogs: no literal strings in JSX.
    files: ['src/ui/**/*.{ts,tsx}', 'src/entrypoints/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          'mode': 'jsx-only',
          'jsx-attributes': {
            exclude: [
              'class',
              'className',
              'id',
              'key',
              'type',
              'name',
              'role',
              'lang',
              'dir',
              'href',
              'src',
              'rel',
              'for',
              'htmlFor',
              'style',
              'width',
              'height',
              'data-.+',
            ],
          },
        },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'config/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  }
)
