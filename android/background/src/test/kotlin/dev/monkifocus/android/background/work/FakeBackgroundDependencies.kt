// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.background.work

import dev.monkifocus.android.background.bedtime.BedtimeWarningRun
import dev.monkifocus.android.background.fakes.AnalyticsTestData
import dev.monkifocus.android.background.fakes.FakeUsageEventsSource
import dev.monkifocus.android.background.fakes.InMemoryActivityEventRepository
import dev.monkifocus.android.background.fakes.InMemoryBlockRepository
import dev.monkifocus.android.background.fakes.InMemoryIngestCursorRepository
import dev.monkifocus.android.background.ingest.AndroidBuckets
import dev.monkifocus.android.background.ingest.BlockAggregation
import dev.monkifocus.android.background.ingest.UsageIngest
import dev.monkifocus.android.background.packs.PackRecheckResult
import dev.monkifocus.android.background.packs.StoredPackCheck
import dev.monkifocus.android.core.domain.engine.instantOf
import dev.monkifocus.android.core.domain.rules.Ruleset
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** The workers' dependencies over in-memory fakes and a fixed clock. */
class FakeBackgroundDependencies(
    now: Instant,
    var ruleset: Ruleset? = null,
) : BackgroundDependencies {
    val source = FakeUsageEventsSource()
    val cursors = InMemoryIngestCursorRepository()
    val store = InMemoryActivityEventRepository()
    val blocks = InMemoryBlockRepository()
    val warnings = mutableListOf<Int>()
    var packChecks = 0

    override val wallClock: Clock = Clock.fixed(now, ZoneOffset.UTC)

    override val usageIngest: UsageIngest =
        UsageIngest(
            source,
            cursors,
            store,
            BlockAggregation(
                store,
                blocks,
                cursors,
                AndroidBuckets(created = instantOf(now.toEpochMilli())),
                AnalyticsTestData.catalog,
                { "device-1" },
                { emptyList() },
                { emptySet() },
            ),
        )

    override val bedtimeWarning: BedtimeWarningRun = BedtimeWarningRun({ ruleset }, cursors) { warnings += it }

    override val storedPacks: StoredPackCheck =
        StoredPackCheck {
            packChecks++
            PackRecheckResult(accepted = 1, rejected = 2)
        }
}
