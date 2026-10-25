// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.platform

/** Implemented by the `Application`, so the service and receivers reach the one [ProtectionGraph]. */
interface ProtectionGraphProvider {
    val protectionGraph: ProtectionGraph
}
