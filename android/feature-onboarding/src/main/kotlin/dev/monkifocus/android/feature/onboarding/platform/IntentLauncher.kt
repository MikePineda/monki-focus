// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.platform

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent

/** Starts the first of [intents] the device can open; answers false when none could. */
fun Context.startFirst(intents: List<Intent>): Boolean =
    intents.any { intent ->
        try {
            startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
