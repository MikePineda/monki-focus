// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.pipeline

/** Port: the user-visible name of an app (its launcher label), for the gate's title. Data, not catalog copy. */
fun interface TargetLabels {
    fun appLabel(packageName: String): String
}
