// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.service.accessibility.notice

/** What [ProtectionNotice] asks the notifier to do. */
sealed interface NoticeCommand {
    data class Post(
        val content: NoticeContent,
    ) : NoticeCommand

    data object Cancel : NoticeCommand

    data object None : NoticeCommand
}
