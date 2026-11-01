// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.app.SearchManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import dev.monkifocus.android.service.accessibility.action.TypedAddress

/**
 * The explicit intent that opens a "Go to another site" entry in the
 * browser the blocked page is in: `ACTION_VIEW` of the http(s) address, or
 * for words `ACTION_WEB_SEARCH`, then `ACTION_SEARCH` (the browser's own
 * engine; never a search URL of ours). Always with the browser's package
 * and only `FLAG_ACTIVITY_NEW_TASK`. Null when the browser resolves none:
 * the caller fires nothing then, since launching the browser alone would
 * bring back the restored blocked tab.
 */
internal object BrowserIntent {
    fun of(
        browserPackage: String,
        address: TypedAddress,
        packageManager: PackageManager,
    ): Intent? {
        val candidates =
            when (address) {
                is TypedAddress.Web -> {
                    listOf(Intent(Intent.ACTION_VIEW, Uri.parse(address.url)).addCategory(Intent.CATEGORY_BROWSABLE))
                }

                is TypedAddress.Search -> {
                    listOf(
                        Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, address.query),
                        Intent(Intent.ACTION_SEARCH).putExtra(SearchManager.QUERY, address.query),
                    )
                }
            }
        return candidates
            .map { it.setPackage(browserPackage).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            .firstOrNull { packageManager.queryIntentActivities(it, 0).isNotEmpty() }
    }
}
