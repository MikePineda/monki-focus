// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.bedtime

/**
 * What the bedtime warning worker does now: post the warning or not, the
 * epoch second the current warning began (the key that makes it once per
 * night) and when to run again (an inexact delay, no exact alarm).
 */
data class BedtimeWarningPlan(
    val notify: Boolean,
    val warningOnset: Long?,
    val nextCheckAt: Long,
)
