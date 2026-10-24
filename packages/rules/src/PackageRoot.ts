// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url'

/**
 * Absolute path of the installed package (`src/` and `dist/` both sit one
 * level below it, so this resolves the same from source and from the build).
 */
export const packageRoot: string = fileURLToPath(new URL('..', import.meta.url))
