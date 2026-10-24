// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.data.db

import dev.monkifocus.android.core.domain.engine.epochSecondsOf
import dev.monkifocus.android.core.domain.engine.instantOf

/*
 * Room stores every instant as INTEGER epoch milliseconds UTC (plan §3.1);
 * the domain speaks UTC RFC 3339 text with whole seconds. These two are the
 * only conversions between them, and both are strict: text that is not an
 * instant throws instead of being stored.
 */

/** Epoch milliseconds of a UTC RFC 3339 instant. */
internal fun millisOf(instant: String): Long = epochSecondsOf(instant) * MILLIS_PER_SECOND

/** The canonical UTC text of stored epoch milliseconds (floored to whole seconds). */
internal fun instantOfMillis(millis: Long): String = instantOf(millis)

internal const val MILLIS_PER_SECOND = 1_000L
