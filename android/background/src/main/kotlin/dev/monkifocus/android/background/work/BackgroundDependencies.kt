// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import dev.monkifocus.android.background.bedtime.BedtimeWarningRun
import dev.monkifocus.android.background.ingest.UsageIngest
import dev.monkifocus.android.background.packs.StoredPackCheck
import java.time.Clock

/** What the workers need from the composition root (`AppGraph` implements it). */
interface BackgroundDependencies {
    /** The wall clock, the only time source of the workers. */
    val wallClock: Clock

    val usageIngest: UsageIngest

    val bedtimeWarning: BedtimeWarningRun

    val storedPacks: StoredPackCheck
}
