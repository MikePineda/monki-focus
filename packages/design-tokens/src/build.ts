// SPDX-License-Identifier: AGPL-3.0-or-later
/** `npm run build`: regenerates every file under dist/ from src/tokens.source.mjs. */
import { renderOutputs } from './GeneratedOutputs.ts'
import { PACKAGE_ROOT } from './PackagePaths.ts'
import { ACCENT } from './tokens.source.mjs'
import { writeOutputs } from './WriteOutputs.ts'

const files = renderOutputs()
writeOutputs(PACKAGE_ROOT, files)
console.log(`design-tokens: wrote ${Object.keys(files).length} files (accent: ${ACCENT})`)
