// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

import android.content.Context
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.service.accessibility.packs.ActivePacks
import java.io.File

/**
 * Downloaded detector packs as the update worker (WP 2.9) stores them:
 * `noBackupFilesDir/detector-packs/<packId>.pack.json` with its detached
 * signature in `<packId>.pack.json.sig`. Only the raw bytes are read here;
 * [ActivePacks] verifies them again on every start. A file over the size
 * limit is not even read.
 */
internal class DownloadedPackFiles(
    context: Context,
) {
    private val dir = File(context.noBackupFilesDir, DIRECTORY)

    fun read(packIds: Collection<String>): Map<String, ActivePacks.Downloaded> =
        packIds
            .mapNotNull { packId ->
                val pack = File(dir, "$packId$PACK_SUFFIX")
                val signature = File(dir, "$packId$PACK_SUFFIX$SIGNATURE_SUFFIX")
                if (!pack.isFile || !signature.isFile || pack.length() > RulesetValidator.MAX_DOCUMENT_BYTES) return@mapNotNull null
                runCatching { packId to ActivePacks.Downloaded(pack.readBytes(), signature.readBytes()) }.getOrNull()
            }.toMap()

    private companion object {
        const val DIRECTORY = "detector-packs"
        const val PACK_SUFFIX = ".pack.json"
        const val SIGNATURE_SUFFIX = ".sig"
    }
}
