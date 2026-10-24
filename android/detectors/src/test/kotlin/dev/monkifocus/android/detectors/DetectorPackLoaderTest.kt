// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * docs/threat-model.md "Reglas": signed, data only, monotonic, allowlisted.
 * The signature is checked by a fake that accepts exactly one byte string
 * (the real Tink verifier is covered in `:core-crypto`).
 */
class DetectorPackLoaderTest {
    private val validSignature = ByteArray(DetectorPackLoader.SIGNATURE_BYTES) { 7 }
    private val now = Instant.parse("2026-10-25T12:00:00Z")

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

    private fun text(packId: String = "instagram"): String = String(RulesResources.packBytes(packId), Charsets.UTF_8)

    private fun withVersion(
        version: String,
        source: String = text(),
    ): String = source.replace("\"packVersion\": \"${installed.packVersion}\"", "\"packVersion\": \"$version\"")

    private fun loader(
        verifier: SignatureVerifier,
        allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
        versions: PackVersionPolicy = PackVersionPolicy.COMPILED,
    ) = DetectorPackLoader(RulesResources.validator, verifier, RulesResources.registeredSurfaces, allowlist, versions)

    private fun download(
        payload: String,
        allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
        versions: PackVersionPolicy = PackVersionPolicy.COMPILED,
        installedPack: DetectorPack = installed,
    ): PackLoadResult =
        downloadBytes(payload.toByteArray(Charsets.UTF_8), allowlist = allowlist, versions = versions, installedPack = installedPack)

    private fun downloadBytes(
        payload: ByteArray,
        signature: ByteArray = validSignature,
        verifier: FakeVerifier = FakeVerifier(payload, validSignature),
        allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
        versions: PackVersionPolicy = PackVersionPolicy.COMPILED,
        installedPack: DetectorPack = installed,
    ): PackLoadResult = loader(verifier, allowlist, versions).loadDownloaded(payload, signature, installedPack, now)

    private fun rejected(reason: PackRejection) = PackLoadResult.Rejected(reason)

    @Test
    fun every_bundled_pack_loads() {
        assertEquals(listOf("instagram", "youtube", "browsers", "settings"), RulesResources.bundledPacks.map { it.packId })
    }

    @Test
    fun the_compiled_minimum_version_is_the_bundled_version() {
        for (pack in RulesResources.bundledPacks) {
            assertEquals(pack.packId, pack.version, PackVersionPolicy.COMPILED.minimumOf(pack.packId))
        }
    }

    @Test
    fun newer_signed_pack_is_accepted() {
        val result = download(withVersion("2026.10.26.1"))

        assertEquals("2026.10.26.1", (result as PackLoadResult.Accepted).pack.packVersion)
    }

    @Test
    fun rejects_pack_with_invalid_signature() {
        val payload = withVersion("2026.10.26.1").toByteArray()

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), downloadBytes(payload, signature = ByteArray(64) { 1 }))
    }

    @Test
    fun unsigned_pack_is_ignored() {
        assertEquals(
            rejected(PackRejection.INVALID_SIGNATURE),
            downloadBytes(withVersion("2026.10.26.1").toByteArray(), signature = ByteArray(0)),
        )
    }

    @Test
    fun signature_covers_the_exact_bytes() {
        val signedPayload = withVersion("2026.10.26.1").toByteArray()
        val reformatted = (String(signedPayload, Charsets.UTF_8) + "\n").toByteArray(Charsets.UTF_8)

        assertEquals(
            rejected(PackRejection.INVALID_SIGNATURE),
            downloadBytes(reformatted, verifier = FakeVerifier(signedPayload, validSignature)),
        )
    }

    @Test
    fun signature_is_checked_before_anything_is_parsed() {
        val garbage = "not json at all".toByteArray()

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), downloadBytes(garbage, signature = ByteArray(64)))
    }

    @Test
    fun oversized_pack_is_rejected_before_the_signature_is_checked() {
        val verifier = FakeVerifier(ByteArray(0), validSignature)
        val huge = ByteArray(256 * 1024 + 1) { ' '.code.toByte() }

        assertEquals(rejected(PackRejection.TOO_LARGE), downloadBytes(huge, verifier = verifier))
        assertTrue(verifier.calls.isEmpty())
    }

    @Test
    fun rejects_older_pack_version() {
        assertEquals(rejected(PackRejection.NOT_NEWER), download(withVersion("2026.01.01.1")))
    }

    @Test
    fun rejects_a_replay_of_the_installed_version() {
        assertEquals(rejected(PackRejection.NOT_NEWER), download(text()))
    }

    @Test
    fun the_bundled_version_is_a_floor_even_when_storage_was_wiped() {
        // A stale installed record (older than this build's bundle) cannot let an old signed pack back in.
        val stale = installed.copy(packVersion = "2026.01.01.1")

        assertEquals(rejected(PackRejection.NOT_NEWER), download(withVersion("2026.06.01.1"), installedPack = stale))
    }

    @Test
    fun pack_versions_compare_numerically() {
        val ten = (download(withVersion("2026.10.25.10")) as PackLoadResult.Accepted).pack

        assertEquals(rejected(PackRejection.NOT_NEWER), download(withVersion("2026.10.25.9"), installedPack = ten))
    }

    @Test
    fun rejects_a_version_that_names_no_calendar_date() {
        assertEquals(rejected(PackRejection.SCHEMA), download(withVersion("2026.13.01.1")))
        assertEquals(rejected(PackRejection.SCHEMA), download(withVersion("2027.02.30.1")))
    }

    @Test
    fun rejects_a_version_dated_after_now_plus_two_days() {
        assertEquals("2026.10.27.1", ((download(withVersion("2026.10.27.1"))) as PackLoadResult.Accepted).pack.packVersion)
        assertEquals(rejected(PackRejection.FUTURE_VERSION), download(withVersion("2026.10.28.1")))
        assertEquals(rejected(PackRejection.FUTURE_VERSION), download(withVersion("9999.12.31.999")))
    }

    @Test
    fun rejects_a_revoked_version() {
        val revoking = PackVersionPolicy(mapOf("instagram" to installed.packVersion), revoked = setOf("instagram@2026.10.26.1"))

        assertEquals(rejected(PackRejection.REVOKED), download(withVersion("2026.10.26.1"), versions = revoking))
    }

    @Test
    fun rejects_duplicate_keys_before_validation() {
        val twice =
            text().replace(
                "\"packVersion\": \"${installed.packVersion}\",",
                "\"packVersion\": \"2026.10.26.1\", \"packVersion\": \"2026.01.01.1\",",
            )

        assertEquals(rejected(PackRejection.DUPLICATE_KEY), download(twice))
    }

    @Test
    fun rejects_package_outside_the_allowlist() {
        val widened =
            withVersion(
                "2026.10.26.1",
            ).replace("\"packages\": [\"com.instagram.android\"]", "\"packages\": [\"com.instagram.android\", \"com.example.banking\"]")

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), download(widened))
    }

    @Test
    fun rejects_a_pack_id_outside_the_allowlist() {
        val narrow = PackageAllowlist(mapOf("youtube" to setOf("com.google.android.youtube")))

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), download(withVersion("2026.10.26.1"), allowlist = narrow))
    }

    @Test
    fun rejects_a_pack_that_would_replace_another_pack_id() {
        val youtube = withVersion("2026.10.26.1", text("youtube"))

        assertEquals(rejected(PackRejection.PACK_ID_MISMATCH), download(youtube))
    }

    @Test
    fun rejects_a_signed_pack_that_breaks_an_invariant() {
        // Valid against the schema and signed, but the DM-reel exemption loses its sender evidence.
        val noSender =
            withVersion("2026.10.26.1")
                .replace("{\"viewId\": \"sender_username_or_fullname\", \"onScreen\": true}", "{\"viewId\": \"clips_ufi_component\"}")

        assertEquals(rejected(PackRejection.INVARIANT), download(noSender))
    }

    @Test
    fun rejects_unknown_fields_and_scripts() {
        val scripted =
            withVersion(
                "2026.10.26.1",
            ).replace("\"minSchemaVersion\": 1,", "\"minSchemaVersion\": 1, \"script\": \"return true\",")
        val predicateRegex =
            withVersion(
                "2026.10.26.1",
            ).replace("{\"viewId\": \"suggested_title\"}", "{\"viewId\": \"suggested_title\", \"regex\": \".*\"}")

        assertEquals(rejected(PackRejection.SCHEMA), download(scripted))
        assertEquals(rejected(PackRejection.SCHEMA), download(predicateRegex))
    }

    @Test
    fun rejects_invalid_utf8_and_invalid_json() {
        val invalidUtf8 = byteArrayOf(0x7b, 0xc3.toByte(), 0x28, 0x7d)

        assertEquals(rejected(PackRejection.INVALID_JSON), downloadBytes(invalidUtf8))
        assertEquals(rejected(PackRejection.INVALID_JSON), download("{\"packId\":"))
    }

    @Test
    fun rejects_a_pack_needing_a_newer_schema() {
        val future = withVersion("2026.10.26.1").replace("\"minSchemaVersion\": 1", "\"minSchemaVersion\": 2")

        assertEquals(rejected(PackRejection.UNSUPPORTED_SCHEMA), download(future))
    }

    @Test
    fun a_throwing_verifier_counts_as_an_invalid_signature() {
        val payload = withVersion("2026.10.26.1").toByteArray()
        val throwing = loader(SignatureVerifier { _, _ -> throw IllegalStateException("broken key") })

        assertEquals(rejected(PackRejection.INVALID_SIGNATURE), throwing.loadDownloaded(payload, validSignature, installed, now))
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
    fun a_bundled_pack_still_passes_the_schema_the_allowlist_and_the_invariants() {
        val widened = text().replace("\"packages\": [\"com.instagram.android\"]", "\"packages\": [\"com.example.banking\"]")
        val noCap = text().replace("\"unclassifiedCapMinutes\": 10", "\"unclassifiedCapMinutes\": 0")

        assertEquals(rejected(PackRejection.PACKAGE_NOT_ALLOWED), RulesResources.bundledLoader.loadBundled(widened.toByteArray()))
        assertEquals(rejected(PackRejection.INVARIANT), RulesResources.bundledLoader.loadBundled(noCap.toByteArray()))
        assertEquals(rejected(PackRejection.SCHEMA), RulesResources.bundledLoader.loadBundled("{}".toByteArray()))
    }
}
