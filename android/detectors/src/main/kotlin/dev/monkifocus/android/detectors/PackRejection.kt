// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.detectors

/** Why a detector pack was refused. A refused pack changes nothing: the active one stays. */
enum class PackRejection(
    val code: String,
) {
    /** Over 256 KiB: refused before the signature is even checked. */
    TOO_LARGE("too_large"),

    /** Missing, malformed or not made with the pinned key. */
    INVALID_SIGNATURE("invalid_signature"),

    /** Not UTF-8 or not JSON. */
    INVALID_JSON("invalid_json"),

    /** An object names the same key twice (parsers disagree on which one wins). */
    DUPLICATE_KEY("duplicate_key"),

    /** Fails `detector-pack.schema.json` (unknown fields, regex-like keys, bad shapes). */
    SCHEMA("schema"),

    /** Needs a schema version this build does not support. */
    UNSUPPORTED_SCHEMA("unsupported_schema"),

    /** Names a pack id or a package outside the compiled [PackageAllowlist]. */
    PACKAGE_NOT_ALLOWED("package_not_allowed"),

    /** A different pack id than the installed pack it would replace. */
    PACK_ID_MISMATCH("pack_id_mismatch"),

    /** Breaks a compiled [PackInvariants] rule (family, evidence, safety net, coverage). */
    INVARIANT("invariant"),

    /** Not newer than the installed pack of the same id, or than the version bundled with this build. */
    NOT_NEWER("not_newer"),

    /** Dated more than [PackVersionPolicy.MAX_FUTURE_DAYS] days after the trusted time. */
    FUTURE_VERSION("future_version"),

    /** A version on the compiled revocation list. */
    REVOKED("revoked"),
}
