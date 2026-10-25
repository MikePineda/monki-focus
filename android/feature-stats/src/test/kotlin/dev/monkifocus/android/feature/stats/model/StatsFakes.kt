// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.stats.model

import dev.monkifocus.android.core.domain.analytics.ActivityBlock
import dev.monkifocus.android.core.domain.analytics.ActivitySource
import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.utcInstantOf
import dev.monkifocus.android.core.domain.ports.BlockRepository
import dev.monkifocus.android.core.domain.ports.Intention
import dev.monkifocus.android.core.domain.ports.IntentionOutcome
import dev.monkifocus.android.core.domain.ports.IntentionRepository
import java.time.Instant

/** Blocks held in a list (read only), for the statistics tests. */
class ListBlockRepository(
    var blocks: List<ActivityBlock> = emptyList(),
    var failing: Boolean = false,
) : BlockRepository {
    override suspend fun upsert(blocks: List<ActivityBlock>) = error("read only")

    override suspend fun replaceRange(
        deviceId: String,
        from: String,
        to: String,
        blocks: List<ActivityBlock>,
    ): List<ActivityBlock> = error("read only")

    override suspend fun between(
        from: String,
        to: String,
    ): List<ActivityBlock> {
        check(!failing) { "store unavailable" }
        return blocks.filter { epochSecondsOf(it.blockStart) >= epochSecondsOf(from) && epochSecondsOf(it.blockStart) < epochSecondsOf(to) }
    }
}

/** Intentions held in a list (read only). */
class ListIntentionRepository(
    var intentions: List<Intention> = emptyList(),
) : IntentionRepository {
    override suspend fun start(intention: Intention) = error("read only")

    override suspend fun close(
        id: String,
        outcome: IntentionOutcome,
        closedAt: String,
    ): Boolean = error("read only")

    override suspend fun open(targetGroup: String): Intention? = null

    override suspend fun startedBetween(
        from: String,
        to: String,
    ): List<Intention> =
        intentions.filter {
            epochSecondsOf(it.startedAt) >= epochSecondsOf(from) &&
                epochSecondsOf(it.startedAt) < epochSecondsOf(to)
        }
}

object StatsTestData {
    const val ZONE = "Europe/Berlin"

    fun at(instant: String): Long = Instant.parse(instant).epochSecond

    fun block(
        start: String,
        key: String?,
        level: Int,
        seconds: Int = 300,
        source: ActivitySource = ActivitySource.ANDROID,
        category: String = "work",
    ) = ActivityBlock("device-1", utcInstantOf(at(start)), key, category, level, source, seconds)

    fun intention(
        startedAt: String,
        outcome: IntentionOutcome?,
    ): Intention {
        val start = at(startedAt)
        return Intention(
            id = "i-$start-${outcome?.code}",
            targetGroup = "rule-1",
            minutes = 5,
            typedWords = 0,
            guardianKeyVerified = false,
            startedAt = utcInstantOf(start),
            endsAt = utcInstantOf(start + 300),
            outcome = outcome,
            closedAt = outcome?.let { utcInstantOf(start + 300) },
        )
    }
}
