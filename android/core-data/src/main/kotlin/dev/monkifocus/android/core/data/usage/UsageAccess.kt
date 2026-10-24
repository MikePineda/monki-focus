// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.usage

/** Whether the user currently grants this app usage access (it can be revoked at any time). */
fun interface UsageAccess {
    fun isGranted(): Boolean
}
