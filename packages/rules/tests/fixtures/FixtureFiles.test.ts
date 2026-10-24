// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  FIXTURE_KINDS,
  NON_KIND_FIXTURE_DIRECTORIES,
  checkFixtureInvariants,
  listFixtureFiles,
  loadFixtures,
  loadSurfaceRegistry,
  schemaValidator,
} from '../../src/index.ts'
import type { Fixture } from '../../src/index.ts'
import { packageRoot } from '../../src/PackageRoot.ts'

const files = listFixtureFiles()

/** Every business rule of the plan has at least one fixture, under exactly this id. */
const REQUIRED_FIXTURE_IDS = [
  'candidates.every_matching_friction_rule_is_a_friction_candidate',
  'candidates.unknown_path_promotes_hide_feed_and_surface_blocks_to_friction',
  'candidates.budget_accrues_to_every_matching_budgeted_rule',
  'candidates.budget_accrues_from_the_start_of_its_schedule',
  'candidates.budget_stops_accruing_at_the_end_of_its_schedule',
  'candidates.pending_zone_counts_an_allow_budget_only_when_active_in_both_zones',
  'decision.valid_until_stops_at_a_waiting_rule_change',
  'decision.valid_until_finds_a_window_start_in_the_spring_forward_gap',
  'decision.valid_until_sees_the_repeated_fall_back_hour',
  'decision.valid_until_waits_for_an_unlock_to_start',
  'rule-change.outrank_check_runs_against_what_applies_today',
  'rule-change.outrank_check_compares_normalised_domains',
  'rule-change.disabling_a_budgeted_allow_rule_waits',
  'rule-change.removing_a_budgeted_allow_rule_waits',
  'rule-change.raising_a_category_level_at_bedtime_waits_until_bedtime_ends',
  'decision.budget_on_an_allow_rule_still_counts_under_a_more_specific_friction',
  'decision.domain_only_url_counts_every_budget_of_the_domain',
  'decision.pending_zone_behind_gives_no_extra_budget_day',
  'url-normalize.semicolon_segment_makes_the_path_unknown',
  'url-normalize.semicolon_inside_a_feed_path_makes_it_unknown',
  'url-normalize.semicolon_inside_a_shorts_path_makes_it_unknown',
  'activity.wildcard_only_path_does_not_beat_a_surface',
  'escalation.counters_saturate_at_their_caps',
  'invalid.duplicate_category_target_after_www_normalisation',
  'invalid.duplicate_category_target_after_alias_normalisation',
  'invalid.duplicate_category_target_after_path_case_normalisation',
  'invalid.unknown_property_is_rejected',
  'invalid.regex_looking_glob_is_rejected',
  'invalid.percent_in_a_glob_is_rejected',
  'invalid.mobile_prefix_leaving_one_label_is_rejected',
  'invalid.www_prefix_leaving_a_public_suffix_is_rejected',
  'invalid.missing_time_zone_is_rejected',
  'specificity.most_specific_rule_wins',
  'specificity.path_rule_beats_domain_rule',
  'specificity.surface_rule_beats_app_rule',
  'specificity.more_domain_labels_wins',
  'specificity.equal_specificity_stricter_mode_wins',
  'specificity.full_tie_breaks_by_rule_id',
  'decision.hide_feed_never_blocks_a_permalink',
  'decision.hide_feed_allows_search',
  'decision.hide_feed_allows_messages',
  'decision.hide_feed_with_unknown_path_gates_instead_of_hiding',
  'decision.hide_feed_with_unknown_path_on_an_unprofiled_site_shows',
  'decision.domain_only_youtube_is_not_allowed_by_default',
  'decision.domain_only_youtube_at_bedtime_is_blocked',
  'decision.new_friction_rule_inherits_escalation',
  'decision.bedtime_follows_the_pinned_zone_not_the_device',
  'decision.pending_time_zone_applies_the_stricter_bedtime',
  'decision.budget_day_follows_the_pinned_zone',
  'decision.rule_on_an_alias_domain_matches_the_canonical_host',
  'decision.budget_on_a_non_winning_candidate_blocks',
  'decision.budget_exhausted_yields_to_an_emergency_override',
  'decision.unlock_for_another_target_does_not_lift_a_block',
  'decision.rejected_url_matches_no_rule',
  'decision.emergency_override_lifts_a_friction_gate',
  'decision.decide_in_timed_out_returns_the_current_gate',
  'decision.hide_feed_beats_allow_at_equal_specificity',
  'specificity.catch_all_path_counts_as_no_path',
  'url-normalize.percent_encoded_unreserved_are_decoded',
  'url-normalize.percent_escapes_are_upper_cased',
  'url-normalize.encoded_slash_makes_the_path_unknown',
  'url-normalize.reddit_controversial_is_a_feed',
  'url-normalize.reddit_user_page_is_a_user_feed',
  'url-normalize.reddit_multireddit_is_a_feed',
  'url-normalize.youtube_subscriptions_is_a_feed',
  'url-normalize.youtube_hashtag_is_explore',
  'url-normalize.instagram_explore_search_is_utility',
  'url-normalize.instagram_explore_tag_is_a_feed',
  'schedule.schedule_uses_the_rule_set_time_zone',
  'escalation.reset_is_measured_from_the_last_event',
  'escalation.third_extension_requires_a_full_gate',
  'rule-change.added_friction_that_outranks_a_block_waits',
  'rule-change.enabling_a_friction_rule_that_outranks_a_block_waits',
  'rule-change.widening_friction_schedule_over_a_block_waits',
  'rule-change.changing_the_time_zone_waits_and_evaluates_both_zones',
  'rule-change.disabling_bedtime_waits_until_bedtime_ends',
  'rule-change.new_change_never_moves_a_pending_effective_from_earlier',
  'rule-change.schedule_containment_uses_the_whole_week',
  'rule-change.lowering_a_category_level_applies_immediately',
  'rule-change.raising_a_category_level_waits',
  'rule-change.changing_work_hours_waits',
  'rule-change.widening_a_block_schedule_applies_immediately',
  'rule-change.disabling_a_block_waits',
  'rule-change.enabling_a_block_applies_immediately',
  'rule-change.adding_a_budget_applies_immediately',
  'rule-change.lowering_a_budget_applies_immediately',
  'rule-change.removing_a_budget_waits',
  'rule-change.adding_bedtime_days_applies_immediately',
  'rule-change.enabling_bedtime_applies_immediately',
  'rule-change.removing_an_allow_rule_applies_immediately',
  'rule-change.changing_a_rule_target_waits',
  'rule-change.effective_from_is_local_midnight_across_dst',
  'decision.allow_listed_subreddit_is_shown',
  'decision.active_intention_allows_access_until_expiry',
  'decision.expired_intention_requires_gate',
  'decision.valid_unlock_allows_blocked_target',
  'decision.expired_unlock_is_ignored',
  'decision.budget_exhausted_blocks_until_local_midnight',
  'decision.budget_resets_at_local_midnight',
  'decision.bedtime_blocks_distracting_targets',
  'decision.bedtime_ignores_allow_rule_without_unlock',
  'decision.emergency_override_allows_its_target_group',
  'decision.friction_and_hide_feed_coexist_on_two_axes',
  'url-normalize.strips_scheme_www_and_mobile_prefix',
  'url-normalize.text_without_slash_marks_path_unknown',
  'url-normalize.idn_domain_is_normalised_to_punycode',
  'schedule.work_hours_default_mon_fri_0900_1730',
  'schedule.bedtime_blocks_from_2230_to_0700',
  'schedule.bedtime_warning_starts_at_2200',
  'schedule.schedule_crossing_midnight_is_evaluated_in_local_tz',
  'schedule.bedtime_survives_dst_fall_back_in_sydney',
  'schedule.bedtime_survives_dst_spring_forward_in_sydney',
  'escalation.escalation_goes_5s_15s_typed_guardian',
  'escalation.escalation_resets_after_two_quiet_hours',
  'escalation.friction_type_never_repeats_consecutively',
  'escalation.l3_without_guardian_falls_back_to_60s_typed',
  'escalation.extending_marks_intention_broken_and_doubles_next_pause',
  'escalation.pause_never_exceeds_60_seconds',
  'escalation.emergency_override_waits_120s_grants_15min_and_records_bypass',
  'rule-change.tightening_a_limit_applies_immediately',
  'rule-change.loosening_a_limit_applies_next_day',
  'rule-change.mixed_change_applies_tightening_now_and_loosening_tomorrow',
  'rule-change.deleting_a_rule_counts_as_loosening',
  'activity.heartbeat_within_pulsetime_extends_event',
  'activity.heartbeat_with_different_data_opens_new_event',
  'activity.idle_time_is_never_counted',
  'activity.audible_active_tab_counts_while_idle',
  'activity.unfocused_browser_counts_nothing',
  'activity.uncategorised_activity_is_neutral',
  'activity.most_specific_category_rule_wins',
  'activity.pulse_formula_matches_rescuetime',
  'activity.pulse_is_null_without_tracked_time',
  'activity.event_crossing_block_boundary_is_split',
  'activity.event_crossing_local_midnight_splits_daily_totals',
  'activity.block_never_exceeds_300_seconds',
  'activity.split_preserves_total_seconds',
  'activity.browser_time_covered_by_web_events_is_not_counted_as_browser',
  'activity.uncovered_browser_time_counts_as_browser_unknown',
  'activity.stale_extension_heartbeat_falls_back_to_window_events',
  'activity.cross_device_overlap_is_capped_per_block',
  'activity.synced_blocks_never_contain_titles_or_urls',
  'activity.daily_totals_respect_dst_in_australia_sydney',
]

const MINIMUM_COUNTS: Record<string, number> = {
  'decision+specificity': 25,
  'url-normalize': 6,
  'schedule': 6,
  'escalation': 4,
  'rule-change': 4,
  'candidates': 6,
  'activity': 20,
  'invalid': 6,
}

function surfacesIn(node: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) surfacesIn(child, found)
  } else if (node !== null && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key === 'surface' && typeof child === 'string') found.add(child)
      surfacesIn(child, found)
    }
  }
  return found
}

describe('fixture files', () => {
  it.each(files.map((file) => [file.relativePath, file] as const))(
    'every_fixture_validates_against_the_fixture_schema %s',
    (_name, file) => {
      expect(schemaValidator().validateDocument('fixture', file.text)).toEqual({ valid: true })
    }
  )

  it('fixture_ids_are_unique', () => {
    const ids = files.map((file) => (file.json as Fixture).id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    expect(duplicates).toEqual([])
  })

  it('fixture_file_name_matches_its_id', () => {
    for (const file of files) {
      const id = (file.json as Fixture).id
      expect(`${id.slice(id.indexOf('.') + 1)}.json`, file.relativePath).toBe(file.fileName)
    }
  })

  it('fixture_lives_in_the_directory_of_its_kind', () => {
    for (const file of files) {
      const fixture = file.json as Fixture
      expect(fixture.kind, file.relativePath).toBe(file.directory)
      expect(fixture.id.startsWith(`${fixture.kind}.`), file.relativePath).toBe(true)
    }
  })

  it('unknown_fixture_kind_fails_loudly', () => {
    const unknown = {
      id: 'telepathy.reads_minds',
      kind: 'telepathy',
      description: 'A kind no runner knows.',
      given: {},
      then: {},
    }
    expect(schemaValidator().validate('fixture', unknown).valid).toBe(false)
    expect(() => loadFixtures('telepathy' as never)).toThrow(/unknown fixture kind/i)
    expect(checkFixtureInvariants(unknown)).toContain('unknown fixture kind: telepathy')
  })

  it('unlock_token_directory_is_a_documented_placeholder', () => {
    const entries = readdirSync(join(packageRoot, 'fixtures/unlock-token'))
    expect(entries).toEqual(['README.md'])
    expect(() => loadFixtures('unlock-token' as never)).toThrow(/packages\/protocol/)
  })

  it('unlock_token_fixture_is_rejected_here', () => {
    const misplaced = { id: 'unlock-token.valid', kind: 'unlock-token', description: 'Misplaced.' }
    expect(schemaValidator().validate('fixture', misplaced).valid).toBe(false)
  })

  it('every_fixture_directory_is_a_known_kind', () => {
    const directories = readdirSync(join(packageRoot, 'fixtures')).sort()
    expect(directories).toEqual([...FIXTURE_KINDS, ...NON_KIND_FIXTURE_DIRECTORIES].sort())
  })

  it.each(files.map((file) => [file.relativePath, file] as const))(
    'every_fixture_satisfies_the_reference_invariants %s',
    (_name, file) => {
      expect(checkFixtureInvariants(file.json)).toEqual([])
    }
  )

  it('minimum_fixture_counts_per_kind_are_met', () => {
    const counts: Record<string, number> = {}
    for (const file of files) {
      const kind =
        file.directory === 'decision' || file.directory === 'specificity'
          ? 'decision+specificity'
          : file.directory
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    for (const [kind, minimum] of Object.entries(MINIMUM_COUNTS)) {
      expect(counts[kind] ?? 0, kind).toBeGreaterThanOrEqual(minimum)
    }
  })

  it('every_business_rule_has_a_fixture', () => {
    const ids = new Set(files.map((file) => (file.json as Fixture).id))
    expect(REQUIRED_FIXTURE_IDS.filter((id) => !ids.has(id))).toEqual([])
  })

  it('fixture_time_zones_are_real_iana_zones', () => {
    // An invalid fixture may carry an unknown zone on purpose.
    const zoneFiles = files.filter((file) => !file.text.includes('"code": "invalid_time_zone"'))
    for (const file of zoneFiles) {
      const text = file.text
      for (const match of text.matchAll(/"timeZone": "([^"]+)"/g)) {
        const zone = match[1] ?? ''
        expect(() => new Intl.DateTimeFormat('en', { timeZone: zone }), zone).not.toThrow()
        expect(
          ['UTC', 'Australia/Sydney', 'Europe/London', 'Pacific/Honolulu'],
          `${file.relativePath}: generic zones only`
        ).toContain(zone)
      }
    }
  })

  it('fixtures_use_only_registered_surfaces', () => {
    const registered = new Set(loadSurfaceRegistry().surfaces.map((surface) => surface.id))
    for (const file of files) {
      for (const surface of surfacesIn(file.json, new Set())) {
        expect(registered.has(surface), `${file.relativePath}: ${surface}`).toBe(true)
      }
    }
  })
})
