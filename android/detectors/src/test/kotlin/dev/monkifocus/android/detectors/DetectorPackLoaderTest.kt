// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * docs/threat-model.md "Reglas": signed, data only, monotonic, allowlisted.
 * The signature is checked by a fake that accepts exactly one byte string
 * (the real Tink verifier is covered in `:core-crypto`).
 */
class DetectorPackLoaderTest {
    private val validSignature = ByteArray(DetectorPackLoader.SIGNATURE_BYTES) { 7 }

    /** Accepts [validSignature] over exactly the bytes it was told about, and records every call. */
    private class FakeVerifier(
        private val signed: ByteArray,
        private val signature: ByteArray,
    ) : SignatureVerifier {
        val calls = mutableListOf<ByteArray>()

        override fun verify(
            message: ByteArray,
            signature: ByteArray,
        ): Boolean {
            calls += message
            return message.contentEquals(signed) && signature.contentEquals(this.signature)
        }
    }

    private val installed = RulesResources.bundledPack("instagram")

    private fun bytes(transform: (String) -> String): ByteArray =
        transform(String(RulesResources.packBytes("instagram"), Charsets.UTF_8)).toByteArray(Charsets.UTF_8)

    private fun withVersion(version: String) =
        bytes {
            it.replace("\"packVersion\": \"${installed.packVersion}\"", "\"packVersion\": \"$version\"")
        }

    private fun download(
        payload: ByteArray,
        signature: ByteArray = validSignature,
        verifier: FakeVerifier = FakeVerifier(payload, validSignature),
        allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
    ): PackLoadResult = DetectorPackLoader(RulesResources.validator, verifier, allowlist).loadDownloaded(payload, signature, installed)

    private fun rejected(reason: PackRejection) = PackLoadResult.Rejected(reason)

    @Test
    fun every_bundled_pack_loads() {
        assertEquals(listOf("instagram", "youtube", "browsers", "settings"), RulesResources.bundledPacks.map { it.packId })
    }

    @Test
    fun newer_signed_pack_is_accepted() {
        val result = download(withVersion("2026.10.26.1"))

        assertEquals("2026.10.26.1", (result as PackLoadResult.Accepted).pack.packVersion)
    }

    @Test
    fun rejects_pack_with_invalid_signature() {
        val payload = withVersion("2026.10.26.1")

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), download(payload, signature = ByteArray(64) { 1 }))
    }

    @Test
    fun unsigned_pack_is_ignored() {
        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), download(withVersion("2026.10.26.1"), signature = ByteArray(0)))
    }

    @Test
    fun signature_covers_the_exact_bytes() {
        val signedPayload = withVersion("2026.10.26.1")
        val reformatted = (String(signedPayload, Charsets.UTF_8) + "\n").toByteArray(Charsets.UTF_8)

        assertEquals(
            rejected(PackRejection.INVALID_SIGNATURE),
            download(reformatted, verifier = FakeVerifier(signedPayload, validSignature)),
        )
    }

    @Test
    fun signature_is_checked_before_anything_is_parsed() {
        val garbage = "not json at all".toByteArray()

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), download(garbage, signature = ByteArray(64)))
    }

    @Test
    fun oversized_pack_is_rejected_before_the_signature_is_checked() {
        val verifier = FakeVerifier(ByteArray(0), validSignature)
        val huge = ByteArray(256 * 1024 + 1) { ' '.code.toByte() }

        assertEquals(rejected(PackRejection.TOO_LARGE), download(huge, verifier = verifier))
        assertTrue(verifier.calls.isEmpty())
    }

    @Test
    fun rejects_older_pack_version() {
        assertEquals(rejected(PackRejection.NOT_NEWER), download(withVersion("2026.01.01.1")))
    }

    @Test
    fun rejects_a_replay_of_the_installed_version() {
        assertEquals(rejected(PackRejection.NOT_NEWER), download(RulesResources.packBytes("instagram")))
    }

    @Test
    fun pack_versions_compare_numerically() {
        val installedTen = DetectorPackLoader(RulesResources.validator, FakeVerifier(withVersion("2026.10.25.10"), validSignature))
        val ten = (installedTen.loadDownloaded(withVersion("2026.10.25.10"), validSignature, installed) as PackLoadResult.Accepted).pack
        val nine = withVersion("2026.10.25.9")

        val result =
            DetectorPackLoader(
                RulesResources.validator,
                FakeVerifier(nine, validSignature),
            ).loadDownloaded(nine, validSignature, ten)

        assertEquals(rejected(PackRejection.NOT_NEWER), result)
    }

    @Test
    fun rejects_package_outside_the_allowlist() {
        val widened =
            withVersion("2026.10.26.1")
                .let {
                    String(it, Charsets.UTF_8)
                }.replace("\"packages\": [\"com.instagram.android\"]", "\"packages\": [\"com.instagram.android\", \"com.example.banking\"]")

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), download(widened.toByteArray()))
    }

    @Test
    fun rejects_a_pack_id_outside_the_allowlist() {
        val narrow = PackageAllowlist(mapOf("youtube" to setOf("com.google.android.youtube")))

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), download(withVersion("2026.10.26.1"), allowlist = narrow))
    }

    @Test
    fun rejects_a_pack_that_would_replace_another_pack_id() {
        val youtube = RulesResources.packBytes("youtube")
        val result =
            DetectorPackLoader(
                RulesResources.validator,
                FakeVerifier(youtube, validSignature),
            ).loadDownloaded(youtube, validSignature, installed)

        assertEquals(rejected(PackRejection.PACK_ID_MISMATCH), result)
    }

    @Test
    fun rejects_unknown_fields_and_scripts() {
        val scripted =
            bytes {
                it.replace(
                    "\"packVersion\": \"${installed.packVersion}\"",
                    "\"packVersion\": \"2026.10.26.1\", \"script\": \"return true\"",
                )
            }
        val predicateScript =
            withVersion("2026.10.26.1")
                .let {
                    String(it, Charsets.UTF_8)
                }.replace("{ \"viewId\": \"suggested_title\" }", "{ \"viewId\": \"suggested_title\", \"regex\": \".*\" }")

        assertEquals(rejected(PackRejection.SCHEMA), download(scripted))
        assertEquals(rejected(PackRejection.SCHEMA), download(predicateScript.toByteArray()))
    }

    @Test
    fun rejects_invalid_utf8_and_invalid_json() {
        val invalidUtf8 = byteArrayOf(0x7b, 0xc3.toByte(), 0x28, 0x7d)

        assertEquals(rejected(PackRejection.INVALID_JSON), download(invalidUtf8))
        assertEquals(rejected(PackRejection.INVALID_JSON), download("{\"packId\":".toByteArray()))
    }

    @Test
    fun rejects_a_pack_needing_a_newer_schema() {
        val future =
            withVersion(
                "2026.10.26.1",
            ).let { String(it, Charsets.UTF_8) }.replace("\"minSchemaVersion\": 1", "\"minSchemaVersion\": 2")

        assertEquals(rejected(PackRejection.UNSUPPORTED_SCHEMA), download(future.toByteArray()))
    }

    @Test
    fun a_throwing_verifier_counts_as_an_invalid_signature() {
        val payload = withVersion("2026.10.26.1")
        val loader = DetectorPackLoader(RulesResources.validator, SignatureVerifier { _, _ -> throw IllegalStateException("broken key") })

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), loader.loadDownloaded(payload, validSignature, installed))
    }

    @Test
    fun bundled_pack_is_fallback() {
        val loader = RulesResources.bundledLoader
        val newer = (download(withVersion("2026.10.26.1")) as PackLoadResult.Accepted).pack
        val older = installed.copy(packVersion = "2026.01.01.1")

        assertSame(installed, loader.active(bundled = installed, downloaded = null))
        assertSame(installed, loader.active(bundled = installed, downloaded = older))
        assertSame(newer, loader.active(bundled = installed, downloaded = newer))
    }

    @Test
    fun a_bundled_pack_still_passes_the_schema_and_the_allowlist() {
        val widened =
            String(
                RulesResources.packBytes("instagram"),
                Charsets.UTF_8,
            ).replace("\"packages\": [\"com.instagram.android\"]", "\"packages\": [\"com.example.banking\"]")

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), RulesResources.bundledLoader.loadBundled(widened.toByteArray()))
        assertEquals(rejected(PackRejection.SCHEMA), RulesResources.bundledLoader.loadBundled("{}".toByteArray()))
    }
}
