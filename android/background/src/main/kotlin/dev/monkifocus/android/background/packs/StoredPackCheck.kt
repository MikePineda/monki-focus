// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.packs

import java.time.Instant

/** Re-verifies the detector packs stored on the device (no download: the app has no network permission). */
fun interface StoredPackCheck {
    fun run(now: Instant): PackRecheckResult
}
