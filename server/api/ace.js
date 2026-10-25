// SPDX-License-Identifier: AGPL-3.0-or-later
/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| Registers the TypeScript hook (@poppinss/ts-exec) and imports the ace
| entrypoint. The production build writes its own ace.js that imports the
| compiled JavaScript directly.
|
*/

import '@poppinss/ts-exec'

await import('./bin/console.js')
