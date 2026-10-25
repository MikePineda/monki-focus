// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.flow

/**
 * Whether Android's "restricted settings" (13+) may keep the accessibility
 * switch greyed out: apps installed outside a session-based store install
 * need App info › ⋮ › "Allow restricted settings" first.
 *
 * The app-op Android keeps for it is read when the device lets us
 * ([ALLOWED] / [RESTRICTED]); otherwise the installer decides a guess
 * ([PROBABLY_ALLOWED] / [PROBABLY_RESTRICTED]).
 */
enum class RestrictedSettings {
    NOT_APPLICABLE,
    ALLOWED,
    RESTRICTED,
    PROBABLY_ALLOWED,
    PROBABLY_RESTRICTED,
    ;

    /** Whether the guidance step belongs in the path. */
    val mayBlock: Boolean get() = this == RESTRICTED || this == PROBABLY_RESTRICTED

    companion object {
        /** Android 13, where restricted settings started. */
        const val FIRST_SDK = 33

        /** `AppOpsManager.MODE_ALLOWED`, `MODE_IGNORED`, `MODE_ERRORED`. */
        private const val MODE_ALLOWED = 0
        private const val MODE_IGNORED = 1
        private const val MODE_ERRORED = 2

        /** Stores that install through a session, which Android does not restrict. */
        val SESSION_STORES: Set<String> = setOf("com.android.vending", "org.fdroid.fdroid", "com.aurora.store")

        /**
         * [sdkInt] of the device, the package that installed us ([installer],
         * null when unknown or sideloaded through a file) and the mode of the
         * restricted-settings app-op when it could be read ([opMode]).
         */
        fun assess(
            sdkInt: Int,
            installer: String?,
            opMode: Int?,
        ): RestrictedSettings =
            when {
                sdkInt < FIRST_SDK -> NOT_APPLICABLE
                opMode == MODE_ALLOWED -> ALLOWED
                opMode == MODE_IGNORED || opMode == MODE_ERRORED -> RESTRICTED
                installer in SESSION_STORES -> PROBABLY_ALLOWED
                else -> PROBABLY_RESTRICTED
            }
    }
}
