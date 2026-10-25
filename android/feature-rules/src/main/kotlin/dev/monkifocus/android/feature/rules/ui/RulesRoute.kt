// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.feature.rules.ui

import android.content.ContentResolver
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import dev.monkifocus.android.core.domain.ports.RulesetSource
import dev.monkifocus.android.core.domain.validation.RulesetValidator
import dev.monkifocus.android.feature.rules.change.RuleChangeOutcome
import dev.monkifocus.android.feature.rules.change.RuleChangeService
import dev.monkifocus.android.feature.rules.change.RulesMessage
import dev.monkifocus.android.feature.rules.change.RulesState
import dev.monkifocus.android.feature.rules.transfer.ImportedRuleset
import dev.monkifocus.android.feature.rules.transfer.RulesetTransfer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

/**
 * [RulesScreen] wired to the [service] (every save goes through it) and to
 * the Storage Access Framework for export and import (the [validator] is
 * built on first import, off the main thread): export writes the
 * configured set to a document the user creates; import reads one the user
 * picks (at most the 256 KiB the validator accepts, plus one byte to tell),
 * validates it whole and proposes it like any edit, so a looser import waits.
 * A refused change reloads the rules, so the next edit starts from what is
 * stored.
 */
@Composable
fun RulesRoute(
    service: RuleChangeService,
    validator: () -> RulesetValidator,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val resolver = LocalContext.current.contentResolver
    var state by remember { mutableStateOf<RulesState?>(null) }
    var message by remember { mutableStateOf<RulesMessage?>(null) }
    LaunchedEffect(service) { state = offMain { service.state() } }

    fun settle(outcome: RuleChangeOutcome) {
        message = RulesMessage.of(outcome)
        when (outcome) {
            is RuleChangeOutcome.Applied -> state = outcome.state
            is RuleChangeOutcome.Pending -> state = outcome.state
            is RuleChangeOutcome.Rejected -> scope.launch { state = offMain { service.state() } }
        }
    }

    val exporter =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(RulesetTransfer.MIME_TYPE)) { uri ->
            val configured = state?.configured
            if (uri == null || configured == null) return@rememberLauncherForActivityResult
            scope.launch {
                val written = writeText(resolver, uri, RulesetTransfer.export(configured))
                message = if (written) RulesMessage.Exported else RulesMessage.FileFailed
            }
        }
    val importer =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            val seen = state
            if (uri == null || seen == null) return@rememberLauncherForActivityResult
            scope.launchImport(resolver, uri, validator) { imported ->
                when (imported) {
                    null -> message = RulesMessage.FileFailed
                    is ImportedRuleset.Invalid -> message = RulesMessage.ImportInvalid(imported.code, imported.location)
                    is ImportedRuleset.Valid -> settle(offMain { service.edit(seen, RulesetSource.IMPORT) { imported.ruleset } })
                }
            }
        }

    RulesScreen(
        state = state,
        message = message,
        actions =
            RulesActions(
                onBack = onBack,
                onEdit = { transform ->
                    val seen = state
                    if (seen != null) scope.launch { settle(offMain { service.edit(seen, transform = transform) }) }
                },
                onCancelPending = {
                    scope.launch {
                        state = offMain { service.cancelPending() }
                        message = RulesMessage.Cancelled
                    }
                },
                onExport = { state?.configured?.let { exporter.launch(RulesetTransfer.fileName(it)) } },
                onImport = { importer.launch(arrayOf(RulesetTransfer.MIME_TYPE)) },
            ),
        modifier = modifier,
    )
}

/** Rule-set work (encoding, schema validation, the engine) runs off the main thread. */
private suspend fun <T> offMain(work: suspend () -> T): T = withContext(Dispatchers.Default) { work() }

/** Reads the picked document off the main thread and hands back what it holds (null: unreadable). */
private fun CoroutineScope.launchImport(
    resolver: ContentResolver,
    uri: Uri,
    validator: () -> RulesetValidator,
    onRead: suspend (ImportedRuleset?) -> Unit,
) {
    launch {
        val imported =
            withContext(Dispatchers.IO) {
                readText(resolver, uri)?.let { RulesetTransfer.import(it, validator()) }
            }
        onRead(imported)
    }
}

private fun readText(
    resolver: ContentResolver,
    uri: Uri,
): String? =
    try {
        resolver.openInputStream(uri)?.use { stream ->
            val bytes = ByteArray(RulesetValidator.MAX_DOCUMENT_BYTES + 1)
            var read = 0
            while (read < bytes.size) {
                val count = stream.read(bytes, read, bytes.size - read)
                if (count < 0) break
                read += count
            }
            String(bytes, 0, read, Charsets.UTF_8)
        }
    } catch (_: IOException) {
        null
    } catch (_: SecurityException) {
        null
    }

private suspend fun writeText(
    resolver: ContentResolver,
    uri: Uri,
    text: String,
): Boolean =
    withContext(Dispatchers.IO) {
        try {
            resolver.openOutputStream(uri, "wt")?.use { it.write(text.toByteArray(Charsets.UTF_8)) } != null
        } catch (_: IOException) {
            false
        } catch (_: SecurityException) {
            false
        }
    }
