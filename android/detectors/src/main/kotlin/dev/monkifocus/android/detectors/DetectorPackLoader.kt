// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

import dev.monkifocus.android.core.domain.rules.RulesJson
import dev.monkifocus.android.core.domain.signing.SignatureVerifier
import dev.monkifocus.android.core.domain.validation.RejectionCode
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.core.domain.validation.ValidationResult
import kotlinx.serialization.SerializationException
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.time.Instant

/**
 * Loads detector packs (plan §1.6, docs/threat-model.md "Reglas"). A
 * downloaded pack is accepted only after, in this order:
 *
 * 1. size: at most [RulesetValidator.MAX_DOCUMENT_BYTES];
 * 2. signature: Ed25519 over the exact file bytes, checked by [verifier]
 *    with its pinned public key, before anything is parsed;
 * 3. strict UTF-8, no duplicate JSON keys, `detector-pack.schema.json`
 *    through [validator], a strict decode and a real calendar `packVersion`;
 * 4. `minSchemaVersion` supported by this build;
 * 5. pack id and every package inside the compiled [allowlist];
 * 6. the compiled [PackInvariants] (families, evidence, safety net);
 * 7. not on the compiled revocation list, not dated after `now` + 2 days;
 * 8. `packVersion` strictly newer than both the installed pack and the
 *    version bundled with this build ([PackVersionPolicy]).
 *
 * Packs are data only: nothing in them is executed. A rejection leaves the
 * installed pack active. The pack bundled in the APK is trusted as part of
 * the signed app (no detached signature) but passes every other check, and
 * it is the fallback whenever no newer downloaded pack is accepted.
 *
 * For the caller: keep a downloaded pack and its signature under
 * `noBackupFilesDir` and run them through [loadDownloaded] again on every
 * start (with the bundled pack as `installed`); never trust a stored decode.
 */
class DetectorPackLoader(
    private val validator: RulesetValidator,
    private val verifier: SignatureVerifier,
    registeredSurfaces: Set<String>,
    private val allowlist: PackageAllowlist = PackageAllowlist.COMPILED,
    private val versions: PackVersionPolicy = PackVersionPolicy.COMPILED,
    private val supportedSchemaVersion: Int = SUPPORTED_SCHEMA_VERSION,
) {
    private val invariants = PackInvariants(registeredSurfaces)

    /** A pack shipped inside the APK. */
    fun loadBundled(bytes: ByteArray): PackLoadResult {
        val result = decode(bytes)
        if (result !is PackLoadResult.Accepted) return result
        val minimum = versions.minimumOf(result.pack.packId) ?: return rejected(PackRejection.PACKAGE_NOT_ALLOWED)
        return if (result.pack.version < minimum) rejected(PackRejection.NOT_NEWER) else result
    }

    /**
     * A pack fetched at runtime (or re-read from storage at start), with its
     * detached signature, the pack it would replace and the trusted time.
     */
    fun loadDownloaded(
        bytes: ByteArray,
        signature: ByteArray,
        installed: DetectorPack,
        now: Instant,
    ): PackLoadResult {
        if (bytes.size > RulesetValidator.MAX_DOCUMENT_BYTES) return rejected(PackRejection.TOO_LARGE)
        if (!verifySafely(bytes, signature)) return rejected(PackRejection.INVALID_SIGNATURE)
        val result = decode(bytes)
        if (result !is PackLoadResult.Accepted) return result
        val pack = result.pack
        val floor = listOfNotNull(installed.version, versions.minimumOf(pack.packId)).max()
        return when {
            pack.packId != installed.packId -> rejected(PackRejection.PACK_ID_MISMATCH)
            versions.isRevoked(pack) -> rejected(PackRejection.REVOKED)
            versions.isFromTheFuture(pack.version, now) -> rejected(PackRejection.FUTURE_VERSION)
            pack.version <= floor -> rejected(PackRejection.NOT_NEWER)
            else -> result
        }
    }

    /** The pack to classify with: the downloaded one when it is newer than the bundled one, else the bundled fallback. */
    fun active(
        bundled: DetectorPack,
        downloaded: DetectorPack?,
    ): DetectorPack =
        downloaded?.takeIf {
            it.packId == bundled.packId &&
                it.version > bundled.version &&
                allowlist.permits(it.packId, it.packages) &&
                invariants.holds(it) &&
                !versions.isRevoked(it)
        } ?: bundled

    private fun decode(bytes: ByteArray): PackLoadResult {
        if (bytes.size > RulesetValidator.MAX_DOCUMENT_BYTES) return rejected(PackRejection.TOO_LARGE)
        val text = strictUtf8(bytes) ?: return rejected(PackRejection.INVALID_JSON)
        when (DuplicateKeyScan.scan(text)) {
            DuplicateKeyScan.Outcome.UNIQUE -> Unit
            DuplicateKeyScan.Outcome.DUPLICATE -> return rejected(PackRejection.DUPLICATE_KEY)
            DuplicateKeyScan.Outcome.MALFORMED -> return rejected(PackRejection.INVALID_JSON)
        }
        when (val validation = validator.validateDocument(SCHEMA_NAME, text)) {
            is ValidationResult.Valid -> Unit
            is ValidationResult.Rejected -> return rejected(rejectionOf(validation.code))
        }
        val pack =
            try {
                RulesJson.decodeFromString(DetectorPack.serializer(), text)
            } catch (_: SerializationException) {
                return rejected(PackRejection.SCHEMA)
            } catch (_: IllegalArgumentException) {
                return rejected(PackRejection.SCHEMA)
            }
        return when {
            PackVersion.parseOrNull(pack.packVersion) == null -> rejected(PackRejection.SCHEMA)
            pack.minSchemaVersion > supportedSchemaVersion -> rejected(PackRejection.UNSUPPORTED_SCHEMA)
            !allowlist.permits(pack.packId, pack.packages) -> rejected(PackRejection.PACKAGE_NOT_ALLOWED)
            !invariants.holds(pack) -> rejected(PackRejection.INVARIANT)
            versions.isRevoked(pack) -> rejected(PackRejection.REVOKED)
            else -> PackLoadResult.Accepted(pack)
        }
    }

    // A verifier must not throw, but a hostile signature must never take the loader down either.
    private fun verifySafely(
        bytes: ByteArray,
        signature: ByteArray,
    ): Boolean =
        try {
            signature.size == SIGNATURE_BYTES && verifier.verify(bytes, signature)
        } catch (_: RuntimeException) {
            false
        }

    private fun strictUtf8(bytes: ByteArray): String? =
        try {
            Charsets.UTF_8
                .newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes))
                .toString()
        } catch (_: CharacterCodingException) {
            null
        }

    private fun rejectionOf(code: RejectionCode): PackRejection =
        when (code) {
            RejectionCode.TOO_LARGE -> PackRejection.TOO_LARGE
            RejectionCode.INVALID_JSON -> PackRejection.INVALID_JSON
            else -> PackRejection.SCHEMA
        }

    private fun rejected(reason: PackRejection) = PackLoadResult.Rejected(reason)

    companion object {
        /** The highest detector-pack schema version this build understands. */
        const val SUPPORTED_SCHEMA_VERSION = 1

        /** Ed25519 detached signatures are 64 bytes. */
        const val SIGNATURE_BYTES = 64

        private const val SCHEMA_NAME = "detector-pack"
    }
}
