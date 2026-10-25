// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.packs

import dev.monkifocus.android.core.domain.validation.RulesetValidator
import java.io.File

/**
 * The downloaded detector packs as the accessibility service reads them:
 * `<dir>/<packId>.pack.json` with its detached signature in
 * `<packId>.pack.json.sig` (`dir` is `noBackupFilesDir/detector-packs`).
 * Only raw bytes are read; a file over the document size limit is skipped.
 */
class StoredPackFiles(
    private val dir: File,
) {
    class Stored(
        val bytes: ByteArray,
        val signature: ByteArray,
    )

    fun read(packIds: Collection<String>): Map<String, Stored> =
        packIds
            .mapNotNull { packId ->
                val pack = File(dir, "$packId$PACK_SUFFIX")
                val signature = File(dir, "$packId$PACK_SUFFIX$SIGNATURE_SUFFIX")
                if (!pack.isFile || !signature.isFile || pack.length() > RulesetValidator.MAX_DOCUMENT_BYTES) return@mapNotNull null
                runCatching { packId to Stored(pack.readBytes(), signature.readBytes()) }.getOrNull()
            }.toMap()

    companion object {
        const val DIRECTORY = "detector-packs"
        private const val PACK_SUFFIX = ".pack.json"
        private const val SIGNATURE_SUFFIX = ".sig"
    }
}
