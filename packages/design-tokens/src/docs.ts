// SPDX-License-Identifier: AGPL-3.0-or-later
/** `npm run docs`: regenerates docs/design/DESIGN.md and README.md from the source. */
import { renderDesignDocs } from './docs/DesignDocs.ts'
import { REPO_ROOT } from './PackagePaths.ts'
import { writeOutputs } from './WriteOutputs.ts'

const files = await renderDesignDocs()
writeOutputs(REPO_ROOT, files)
console.log(`design-tokens: wrote ${Object.keys(files).join(', ')}`)
