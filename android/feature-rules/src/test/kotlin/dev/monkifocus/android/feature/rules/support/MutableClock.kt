// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.support

import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** A wall clock the test moves (`clock.set("2026-10-27T22:00:00Z")`). */
class MutableClock(
    at: String,
) : Clock() {
    private var instant: Instant = Instant.parse(at)

    fun set(at: String) {
        instant = Instant.parse(at)
    }

    override fun instant(): Instant = instant

    override fun millis(): Long = instant.toEpochMilli()

    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId): Clock = this
}
