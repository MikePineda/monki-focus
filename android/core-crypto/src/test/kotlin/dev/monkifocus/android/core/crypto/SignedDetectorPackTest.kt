// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.crypto

import com.google.crypto.tink.subtle.Ed25519Sign
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.detectors.DetectorPack
import dev.monkifocus.android.detectors.DetectorPackLoader
import dev.monkifocus.android.detectors.PackLoadResult
import dev.monkifocus.android.detectors.PackRejection
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/** A downloaded pack through [DetectorPackLoader] with the real Tink verifier and a pinned key. */
class SignedDetectorPackTest {
    private val keyPair = Ed25519Sign.KeyPair.newKeyPair()
    private val signer = Ed25519Sign(keyPair.privateKey)
    private val loader = DetectorPackLoader(validator(), TinkEd25519Verifier(keyPair.publicKey))

    private val bundledBytes = resource("detectors/android/instagram.pack.json").readBytes()
    private val bundled: DetectorPack = (loader.loadBundled(bundledBytes) as PackLoadResult.Accepted).pack
    private val newerBytes =
        String(bundledBytes, Charsets.UTF_8)
            .replace("\"packVersion\": \"${bundled.packVersion}\"", "\"packVersion\": \"2099.01.01.1\"")
            .toByteArray(Charsets.UTF_8)

    @Test
    fun newer_pack_signed_with_the_pinned_key_is_accepted() {
        val result = loader.loadDownloaded(newerBytes, signer.sign(newerBytes), installed = bundled)

        assertEquals("2099.01.01.1", (result as PackLoadResult.Accepted).pack.packVersion)
    }

    @Test
    fun pack_signed_with_another_key_is_rejected() {
        val stranger = Ed25519Sign(Ed25519Sign.KeyPair.newKeyPair().privateKey)

        val result = loader.loadDownloaded(newerBytes, stranger.sign(newerBytes), installed = bundled)

        assertEquals(PackLoadResult.Rejected(PackRejection.INVALID_SIGNATURE), result)
    }

    private fun resource(relative: String): File =
        File(requireNotNull(javaClass.getResource("/$relative")) { "$relative is not on the test classpath" }.toURI())

    private fun validator(): RulesetValidator {
        val schemas =
            resource("schema/v1")
                .listFiles { file -> file.name.endsWith(".schema.json") }!!
                .associate { it.name.removeSuffix(".schema.json") to it.readText() }
        return RulesetValidator(schemas, aliases = emptyMap())
    }
}
