// SPDX-License-Identifier: AGPL-3.0-or-later
package dev.monkifocus.android.core.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * The theme compiles against the generated `packages/design-tokens` Kotlin
 * files; these tests prove those values are the ones in `tokens.json`, so a
 * stale or hand-edited copy fails the build.
 */
class DesignTokensParityTest {
    private val tokens: JsonObject =
        Json
            .parseToJsonElement(
                File(requireNotNull(System.getProperty("monki.designTokensJson")) { "monki.designTokensJson is not set" }).readText(),
            ).jsonObject

    @Test
    fun color_tokens_match_design_tokens_json() {
        val colors = tokens.getValue("color").jsonArray.map { it.jsonObject }

        assertEquals(
            "every token in tokens.json has a Compose colour and nothing more",
            colors.map { it.string("compose") }.toSortedSet(),
            SEMANTIC_COLORS.keys.toSortedSet(),
        )
        colors.forEach { token ->
            val read = SEMANTIC_COLORS.getValue(token.string("compose"))
            assertColor("light ${token.string("name")}", token.string("light"), read(MonkiLightColors))
            assertColor("dark ${token.string("name")}", token.string("dark"), read(MonkiDarkColors))
        }
    }

    @Test
    fun material_roles_match_design_tokens_json() {
        val material = tokens.getValue("material").jsonObject
        listOf("light" to MonkiLightColorScheme, "dark" to MonkiDarkColorScheme).forEach { (theme, scheme) ->
            val roles = material.getValue(theme).jsonObject
            MATERIAL_ROLES.forEach { (role, read) ->
                val hex = roles[kebabCase(role)]?.jsonPrimitive?.content
                assertColor("$theme material $role", requireNotNull(hex) { "tokens.json has no $theme role $role" }, read(scheme))
            }
        }
    }

    @Test
    fun spacing_and_radius_tokens_match_design_tokens_json() {
        assertDimensions("spacing", SPACING)
        assertDimensions("radius", RADIUS)
    }

    private fun assertDimensions(
        group: String,
        expected: Map<String, Dp>,
    ) {
        val entries = tokens.getValue(group).jsonArray.map { it.jsonObject }
        assertEquals("$group tokens", entries.map { camelCase(it.string("name")) }.toSortedSet(), expected.keys.toSortedSet())
        entries.forEach { entry ->
            val name = camelCase(entry.string("name"))
            assertEquals(
                "$group $name",
                entry
                    .getValue("px")
                    .jsonPrimitive.int
                    .toFloat(),
                expected.getValue(name).value,
                0f,
            )
        }
    }

    private fun assertColor(
        what: String,
        hex: String,
        actual: Color,
    ) {
        assertEquals(what, argbOf(hex).hex(), actual.toArgb().hex())
    }

    private fun JsonObject.string(key: String): String = getValue(key).jsonPrimitive.content

    private companion object {
        /** `#rrggbb` or `#rrggbbaa` (CSS order) as an ARGB int (Compose order). */
        fun argbOf(hex: String): Int {
            val digits = hex.removePrefix("#")
            require(digits.length == 6 || digits.length == 8) { "not a hex colour: $hex" }
            val rgb = digits.substring(0, 6).toLong(16)
            val alpha = if (digits.length == 8) digits.substring(6, 8).toLong(16) else 0xFFL
            return ((alpha shl 24) or rgb).toInt()
        }

        fun Int.hex(): String = "#" + Integer.toHexString(this).padStart(8, '0')

        fun camelCase(kebab: String): String =
            kebab
                .split('-')
                .mapIndexed { index, part ->
                    if (index ==
                        0
                    ) {
                        part
                    } else {
                        part.replaceFirstChar { it.uppercaseChar() }
                    }
                }.joinToString("")

        fun kebabCase(camel: String): String = camel.replace(Regex("([a-z0-9])([A-Z])"), "$1-$2").lowercase()

        val SEMANTIC_COLORS: Map<String, (MonkiColors) -> Color> =
            mapOf(
                "surface0" to MonkiColors::surface0,
                "surface1" to MonkiColors::surface1,
                "surface2" to MonkiColors::surface2,
                "scrim" to MonkiColors::scrim,
                "ink1" to MonkiColors::ink1,
                "ink2" to MonkiColors::ink2,
                "ink3" to MonkiColors::ink3,
                "line" to MonkiColors::line,
                "lineStrong" to MonkiColors::lineStrong,
                "accent" to MonkiColors::accent,
                "accentHover" to MonkiColors::accentHover,
                "accentInk" to MonkiColors::accentInk,
                "accentSoft" to MonkiColors::accentSoft,
                "focus" to MonkiColors::focus,
                "level0" to MonkiColors::level0,
                "level1" to MonkiColors::level1,
                "level2" to MonkiColors::level2,
                "level3" to MonkiColors::level3,
                "level4" to MonkiColors::level4,
                "markNeutral" to MonkiColors::markNeutral,
                "markMuted" to MonkiColors::markMuted,
                "gridline" to MonkiColors::gridline,
                "baseline" to MonkiColors::baseline,
                "statusGood" to MonkiColors::statusGood,
                "statusWarning" to MonkiColors::statusWarning,
                "statusCritical" to MonkiColors::statusCritical,
            )

        val MATERIAL_ROLES: Map<String, (ColorScheme) -> Color> =
            mapOf(
                "background" to ColorScheme::background,
                "onBackground" to ColorScheme::onBackground,
                "surface" to ColorScheme::surface,
                "surfaceDim" to ColorScheme::surfaceDim,
                "surfaceBright" to ColorScheme::surfaceBright,
                "surfaceContainerLowest" to ColorScheme::surfaceContainerLowest,
                "surfaceContainerLow" to ColorScheme::surfaceContainerLow,
                "surfaceContainer" to ColorScheme::surfaceContainer,
                "surfaceContainerHigh" to ColorScheme::surfaceContainerHigh,
                "surfaceContainerHighest" to ColorScheme::surfaceContainerHighest,
                "surfaceVariant" to ColorScheme::surfaceVariant,
                "onSurface" to ColorScheme::onSurface,
                "onSurfaceVariant" to ColorScheme::onSurfaceVariant,
                "inverseSurface" to ColorScheme::inverseSurface,
                "inverseOnSurface" to ColorScheme::inverseOnSurface,
                "outline" to ColorScheme::outline,
                "outlineVariant" to ColorScheme::outlineVariant,
                "surfaceTint" to ColorScheme::surfaceTint,
                "primary" to ColorScheme::primary,
                "onPrimary" to ColorScheme::onPrimary,
                "primaryContainer" to ColorScheme::primaryContainer,
                "onPrimaryContainer" to ColorScheme::onPrimaryContainer,
                "inversePrimary" to ColorScheme::inversePrimary,
                "secondary" to ColorScheme::secondary,
                "onSecondary" to ColorScheme::onSecondary,
                "secondaryContainer" to ColorScheme::secondaryContainer,
                "onSecondaryContainer" to ColorScheme::onSecondaryContainer,
                "tertiary" to ColorScheme::tertiary,
                "onTertiary" to ColorScheme::onTertiary,
                "tertiaryContainer" to ColorScheme::tertiaryContainer,
                "onTertiaryContainer" to ColorScheme::onTertiaryContainer,
                "error" to ColorScheme::error,
                "onError" to ColorScheme::onError,
                "errorContainer" to ColorScheme::errorContainer,
                "onErrorContainer" to ColorScheme::onErrorContainer,
            )

        val SPACING: Map<String, Dp> =
            mapOf(
                "spaceXs" to MonkiSpacing.spaceXs,
                "spaceSm" to MonkiSpacing.spaceSm,
                "spaceMd" to MonkiSpacing.spaceMd,
                "spaceLg" to MonkiSpacing.spaceLg,
                "spaceXl" to MonkiSpacing.spaceXl,
                "space2xl" to MonkiSpacing.space2xl,
                "space3xl" to MonkiSpacing.space3xl,
                "row" to MonkiSpacing.row,
                "rowCompact" to MonkiSpacing.rowCompact,
                "tapMin" to MonkiSpacing.tapMin,
                "tap" to MonkiSpacing.tap,
                "tapLg" to MonkiSpacing.tapLg,
                "columnMax" to MonkiSpacing.columnMax,
                "popupWidth" to MonkiSpacing.popupWidth,
                "panelWidth" to MonkiSpacing.panelWidth,
            )

        val RADIUS: Map<String, Dp> =
            mapOf(
                "radiusSm" to MonkiRadius.radiusSm,
                "radiusMd" to MonkiRadius.radiusMd,
                "radiusLg" to MonkiRadius.radiusLg,
                "radiusXl" to MonkiRadius.radiusXl,
                "radiusFull" to MonkiRadius.radiusFull,
            )
    }
}
