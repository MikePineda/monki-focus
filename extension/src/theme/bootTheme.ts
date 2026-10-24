// SPDX-License-Identifier: AGPL-3.0-or-later
import { applyTheme } from './applyTheme'
import { readCachedTheme } from './ThemeCache'

/*
 * Theme boot, loaded by every extension page as the first
 * `<script type="module">` in <head>. MV3's CSP forbids inline scripts, so
 * this tiny module sets `data-theme` from the synchronous cache before the
 * page module renders anything; startPage then confirms it from storage.
 */
applyTheme(readCachedTheme())
