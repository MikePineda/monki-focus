// SPDX-License-Identifier: AGPL-3.0-or-later
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** packages/design-tokens */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The monorepo root (docs/design lives there). */
export const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..')
