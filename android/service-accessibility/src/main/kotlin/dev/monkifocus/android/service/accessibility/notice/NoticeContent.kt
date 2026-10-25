// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

/** What the notice says: whom it names and whether an exit is under way. */
data class NoticeContent(
    val guardianLinked: Boolean,
    val exitPending: Boolean,
)
