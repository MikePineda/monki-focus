// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.onboarding.platform

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent

/**
 * Starts the first of [intents] that resolves on the device and opens;
 * answers false when none could (the next one is the fallback).
 */
fun Context.startFirst(intents: List<Intent>): Boolean =
    intents.any { intent ->
        if (intent.resolveActivity(packageManager) == null) return@any false
        try {
            startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
