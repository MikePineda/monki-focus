# Rules semantics (v1, normative)

This document is the contract every engine implements: `packages/engine`
(TypeScript), Android `:core-domain` (Kotlin) and macOS `MonkiCore` (Swift).
The fixtures under `fixtures/` are the executable form of this text. When the
text and a fixture disagree, it is a bug in one of them: fix it in a pull
request that changes both. The key words MUST, MUST NOT and SHOULD are used as
in RFC 2119.

All functions below are **pure**: the clock (`now`), the time zone and every
input are parameters. No I/O, no implicit time.

## 1. Conventions

- **Instants** in inputs are RFC 3339 with an explicit offset and whole
  seconds. Every instant an engine **computes** (escalation state, rule-change
  `effectiveFrom`, analytics) is written in UTC with `Z` and no fractional
  seconds (`2026-10-25T23:00:00Z`), so fixture comparison is a string compare.
- **Local time** means the wall clock in the given IANA time zone. Days of the
  week, local dates and schedules are always evaluated in local time.
- **Intervals** are half-open: `[start, end)`.
- **String order** is code-unit (ASCII) order. Rule ids, surface ids and
  activity keys are ASCII by schema, so every platform sorts them identically.
- **Sets in fixtures.** `then` arrays are written in a defined order (stated
  per operation below); runners compare them in order.
- **Limits.** Every document (rule set, site profile, detector pack, fixture)
  MUST be rejected when its UTF-8 serialisation exceeds 256 KiB, when it has a
  field the schema does not define (`additionalProperties: false`
  everywhere) or when it fails its schema. Data contains literals, globs and
  view ids only, never regular expressions or code.

## 2. URL normalisation (`url-normalize`)

`normalizeUrl(urlText, siteProfiles) → {host, path, pathKnown, surface} | {rejected}`

1. Trim surrounding whitespace.
2. **Scheme.** The text has a scheme when it starts with
   `[A-Za-z][A-Za-z0-9+.-]*:` and the part before `:` contains no `.`. A scheme
   other than `http`/`https` (case-insensitive) → `{rejected: "not_http"}`.
   Without a scheme, prepend `https://`.
3. **pathKnown** is `false` iff the original text had no scheme and contains
   none of `/`, `?`, `#` (a bare domain, as mobile URL bars show it).
   Otherwise `true`.
4. Parse with WHATWG URL semantics (`new URL`, `java.net.URI` + IDN,
   `URLComponents` + IDNA must agree on the fixtures). User info, port, query
   and fragment are discarded.
5. **Host:** lower-case ASCII (IDN → punycode), drop one trailing `.`, then
   drop one leading `www.` or `m.` label. The result MUST be a domain with at
   least two labels and an alphabetic or punycode TLD; otherwise (IP
   addresses, `localhost`) → `{rejected: "invalid_host"}`.
6. **Aliases:** if the host equals an alias of a site profile, or ends with
   `.` + that alias, replace that alias suffix with the profile's `domain`
   (`twitter.com` → `x.com`, `mobile.twitter.com` → `mobile.x.com`).
7. **Path:** the URL path split on `/`, empty segments dropped, re-joined with
   a leading `/`; the root is `/`. Case and percent-encoding are kept as the
   parser produced them. No trailing slash.
8. **Surface:** `null` when `pathKnown` is false. Otherwise find the profile
   whose `domain` equals the host or is a dot-suffix of it; among its globs
   that match the path (§3.2), the most specific wins (§4 steps 2 and 4, then
   surface id ascending). No match → `null`.

## 3. Targets and matching

### 3.1 Targets

- `{kind: "app", package}` matches an app observation with the same package
  (Android package name or macOS bundle id).
- `{kind: "site", domain, path?}` matches a site observation whose host equals
  `domain` or ends with `.` + `domain`. With `path`, the glob must match the
  observed path; a site target with a path **never** matches when
  `pathKnown` is false.
- `{kind: "surface", surface}` matches any observation whose resolved surface
  equals it: on the web from the site profile (§2.8), in an app from the
  detector (`AppObservation.surface`). One surface rule therefore acts on the
  app and the web alike.

### 3.2 Path globs

A glob is `/`, or `/`-separated segments where each segment is a literal, `*`
(exactly one segment) or a final `**` (zero or more segments). `/reels/**`
matches `/reels`, `/reels/a` and `/reels/a/b`; `/r/*` matches `/r/x` but not
`/r/x/comments`. Literal segments compare **ASCII case-insensitively**. There
are no partial wildcards (`/r/foo*` is invalid).

## 4. Specificity

Among candidates on one axis, the most specific wins. Compare in order; the
first difference decides:

1. **Refinement:** surface target, or site target with a path = 1; app target
   or site target without a path = 0. Higher wins.
2. **Literal path segments** (site targets with a path; 0 otherwise). More
   wins.
3. **Domain labels** (site targets; 0 otherwise). More wins
   (`old.reddit.com` over `reddit.com`).
4. **Wildcards** (`*` and `**` count 1 each). Fewer wins.
5. **Stricter mode:** `block > friction > hide-feed > allow`.
6. **Rule id**, code-unit ascending: the smallest id wins (determinism only).

## 5. Decision (`decision`, `specificity`)

`decide(ruleset, observation, state, now, timeZone) → Decision`

### 5.1 Candidates

A rule is a candidate when `enabled` is true, its schedules are active at
`now` (§6; empty = always; `{ref: "workHours"}` resolves to
`ruleset.workHours`) and its target matches the normalised observation. A site
observation that normalises to `rejected` matches no rule. Two independent
axes then choose a winner each with §4:

- **access** candidates: modes `allow`, `friction`, `block`;
- **content** candidates: modes `hide-feed` and `allow` (an allow rule speaks
  for both axes).

### 5.2 Access axis

Restrictions are checked in this order. Each one either **applies** (the
decision is final) or is **lifted** (continue with the next):

1. **Bedtime**: phase `active` (§6.2) and the observation's category level
   (§9) is ≤ 25 → `block`, reason `schedule_bedtime`, `ruleId` null. No rule
   lifts it.
2. **Budget**: any candidate on either axis whose `dailyBudgetMinutes` is set
   and `state.usage.secondsByRule[rule.id] ≥ dailyBudgetMinutes × 60` →
   `block`, reason `budget_exhausted`, `ruleId` = that rule (several: the most
   specific by §4). `usage` is ignored unless `usage.localDate` is today's
   local date, so a budget block lasts until local midnight.
3. **Rule block**: access winner with mode `block` → `block`, `rule_match`.
4. **Friction**: access winner with mode `friction` → `gate`, reason
   `intention_required`, with the gate preview of §7.4.

Lifts, tried in this order for each restriction:

- a **verified unlock** whose `target` matches the observation and
  `notBefore ≤ now < expiresAt` lifts any restriction → reason
  `unlock_active`;
- an **emergency override**: the escalation state of the restriction's group
  (the rule id, or `bedtime` for bedtime) has phase `override_active` and
  `now < overrideEndsAt` → reason `emergency_active`;
- an **intention** (friction only): the group's state has phase `active` and
  `now < intentionExpiresAt` → reason `intention_active`.

If every restriction that matched was lifted, access is `allow` with the
reason of the lift of the **first** (highest-precedence) lifted restriction
and that restriction's `ruleId` (null for bedtime). If no restriction matched:
access winner `allow` → `allow`, `rule_match`; no access winner → `allow`,
`no_rule`. Unlocks are verified by adapters (signature, device, replay) before
they reach the engine; the engine only checks time and target.

### 5.3 Content axis

No content winner → `show`. Winner with mode `allow` → `show`. Winner with
mode `hide-feed`:

- `pathKnown` false → `show` (`path_unknown_allow`: never risk a permalink);
- resolved surface of kind `feed` → `hide-feed`;
- surface of kind `permalink` or `utility` (search, messages) → `show`
  (`permalink_never_hidden`);
- no surface → `show` (`not_a_feed`).

### 5.4 Primary outcome

`ruleId`, `reason` and `explanationKey` describe one outcome:

- the **access** outcome, unless access is `allow` with reason `rule_match`
  or `no_rule` **and** the content winner is a `hide-feed` rule;
- in that case the **content** outcome: `rule_match` (hidden) or one of
  `path_unknown_allow`, `permalink_never_hidden`, `not_a_feed`, with the
  hide-feed rule's id.

`explanationKey` is fixed by the primary outcome:

| reason       | key                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `rule_match` | `decision.blocked_by_rule` if access is `block`; else `decision.feed_hidden` if content is `hide-feed`; else `decision.allowed_by_rule` |
| any other    | `decision.<reason>`                                                                                                                     |

`gate` is present iff access is `gate`. The domain never returns text.

## 6. Schedules and bedtime (`schedule`)

### 6.1 Schedules

A schedule `{days, start, end}` defines, for each listed day `d`, the window
`[d + start, d + start + length)` in **local wall-clock minutes**, where
`length = (end − start) mod 24 h`, and `0` means 24 hours. A window that
crosses midnight belongs to the day it **starts** on. A schedule is active at
`now` when `now`'s local wall time falls in one of its windows (check the
windows of the previous, current and next local day). Wall-clock arithmetic
makes DST transitions harmless: a window that starts in the spring-forward
gap begins at the first existing minute, a window wholly inside the gap does
not occur that day, and the repeated fall-back hour is inside a window both
times. Australia/Sydney 2026: DST ends Sunday 5 April (03:00 AEDT → 02:00
AEST) and starts Sunday 4 October (02:00 AEST → 03:00 AEDT).

### 6.2 Bedtime

`bedtimePhase(bedtime, now, timeZone) → inactive | warning | active`.
Disabled → `inactive`. `active` inside a window built like §6.1 from
`days/start/end`; otherwise `warning` inside
`[start − warnMinutesBefore, start)` of a listed day (wall-clock minutes);
otherwise `inactive`. The starter preset uses 22:30–07:00 every day with a
30-minute warning (from 22:00).

## 7. Escalation (`escalation`)

`nextEscalation(state, event, now, guardianLinked) → {state, effects}`.
One state per **target group**: the id of the friction rule (or the blocked
rule / `bedtime` for emergency overrides). The initial state is `idle` with
counters 0, `pendingExtension` false and every other field null. Events that
do not apply in the current phase leave the state unchanged (no error).

### 7.1 Gates

`level = min(attemptCount − 1, 3)`. Base pause: L0 5 s, L1 15 s, L2 15 s, L3
15 s with a linked guardian, 60 s without. `pauseSeconds = min(base × 2^brokenCount, 60)`.
`requiresTypedIntention` from L2; `requiresGuardianKey` only at L3 with a
linked guardian. Without a guardian L3 is therefore 60 s plus a typed
intention.

**Friction type** rotates `countdown → breath → reflect → type-intention →
countdown`, starting with `countdown` when `lastFrictionType` is null, and is
always the successor of `lastFrictionType`, which survives session resets: it
never repeats twice in a row.

### 7.2 Session

Attempts count in a session that resets when a `visit` arrives at least
2 hours (7200 s) after `lastAttemptAt`: `attemptCount` and `brokenCount`
return to 0 before the new attempt is counted. There is no reset at local
midnight.

### 7.3 Transitions

| event                    | from                                                                                     | effect                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visit`                  | `idle`, expired `active`/`override_active`                                               | session check (§7.2), `attemptCount += 1`, `lastAttemptAt = now`, new gate (§7.1), `lastFrictionType` = its type, `pauseEndsAt = now + pause`, phase `pausing`, other timers null |
| `visit`                  | `pausing`, `asking`, `timed_out`, `override_waiting`, current `active`/`override_active` | no change (reloading never resets a pause)                                                                                                                                        |
| `pause_elapsed`          | `pausing` and `now ≥ pauseEndsAt`                                                        | `asking`; with `pendingExtension`: `active`, `intentionExpiresAt = now + 300 s`, gate and pause cleared                                                                           |
| `close`                  | `pausing`, `asking`, `override_waiting`                                                  | `idle`; gate, pause, extension and override timers cleared (the attempt still counts)                                                                                             |
| `commit`                 | `asking`                                                                                 | `active`, `intentionExpiresAt = now + minutes`; ignored when typing is required and `typedWords < 3`, or the guardian key is required and not verified                            |
| `intention_expired`      | `active` and `now ≥ intentionExpiresAt`                                                  | `timed_out`                                                                                                                                                                       |
| `leave`                  | `active`, `timed_out`                                                                    | `idle` (intention kept)                                                                                                                                                           |
| `extend`                 | `timed_out`                                                                              | `brokenCount += 1`; gate at the current level with the doubled pause, next friction type, no typing or key; `pendingExtension` true; phase `pausing`                              |
| `emergency_request`      | `idle`, `pausing`, `asking`, `timed_out`                                                 | `override_waiting`, `overrideReadyAt = now + 120 s`                                                                                                                               |
| `emergency_wait_elapsed` | `override_waiting` and `now ≥ overrideReadyAt`                                           | `override_active`, `overrideEndsAt = now + 15 min`, effect `record_bypass` (the bypass event is always reported to the guardian, queued while offline)                            |
| `emergency_expired`      | `override_active` and `now ≥ overrideEndsAt`                                             | `idle`, override timers cleared                                                                                                                                                   |

### 7.4 Gate preview in `decide`

For a friction restriction without a lift, `decide` returns the gate the next
`visit` would produce: the state's current `gate` when the phase is
`pausing` or `asking`, otherwise the gate computed by §7.1–7.2 as if a `visit`
happened at `now` (missing state = initial state). The adapter then sends the
`visit` to `nextEscalation`; the stored gate equals the preview.

## 8. Rule changes (`rule-change`)

`effectiveRuleSet(old, new, now, timeZone) → {effectiveToday, effectiveFrom}`.
A change that only **tightens** applies at once; anything else (loosening, or
not provably tightening) waits for the next local midnight. Each part is
judged on its own:

- **Rules, by id.** Added: tightening iff enabled with mode ≠ `allow`.
  Removed: tightening iff it was an enabled `allow` rule. Modified: tightening
  iff every changed field tightens: target unchanged; `enabled` false → true
  for a non-allow rule, or true → false for an allow rule; mode `allow → any`,
  `friction → block`, `hide-feed → block`; schedules equal, or becoming empty
  (always) on a non-allow rule; budget added or lowered; `note` is neutral.
- **Bedtime:** tightening iff it becomes enabled, or stays enabled with
  `days ⊇ old.days` and a window containing the old one (wall-clock minutes,
  §6.1). `warnMinutesBefore` is neutral.
- **workHours:** any change waits.
- **Categories, by target:** tightening iff present in both with a level that
  is lower or equal; any other change waits.

`effectiveToday` is `new` with every waiting part replaced by its `old`
version (added loosening rules left out, removed restrictive rules kept), with
`new`'s `revision` and `updatedAt`, rules sorted by id. `effectiveFrom` is the
next local midnight as a UTC instant, or null when nothing waits (then
`effectiveToday` equals `new`). Runners compare rules as a set keyed by id.

## 9. Categories

`categorise(activity, assignments, includeDefaults) → {level, categoryPath}`.
Candidates: the rule set's `categories` and, when included,
`data/categories/default.json`, matched like rule targets (§3; an activity is
`{source, activityKey, path, surface}` where `activityKey` is the normalised
domain or the package). The most specific wins by §4 steps 1–4; on a full tie
a user assignment beats a default, then the lower level, then list order.
No match → `{level: 50, categoryPath: "uncategorised"}`. Levels are 0, 25,
50, 75, 100 (RescueTime −2..2 scaled; 0 = very distracting).

## 10. Analytics (`activity`)

Events follow the ActivityWatch model `{timestamp, duration, data}` with UTC
timestamps and whole-second durations. Each fixture names its `operation`.

1. **`heartbeat-merge`** (AW semantics). For each heartbeat, if the last event
   has deep-equal `data` and `last.timestamp ≤ hb.timestamp ≤ last.timestamp +
last.duration + pulsetime`, set `last.duration = max(last.duration,
hb.timestamp + hb.duration − last.timestamp)`; otherwise append the
   heartbeat as a new event.
2. **`probe`** (browser tab sampling). No heartbeat (`null`) when no browser
   window is focused, the screen is locked, there is no tab, the URL is not
   http(s), or the user is idle and the tab is not audible (or
   `countAudibleWhileIdle` is off). Otherwise a heartbeat at `now` with
   duration 0 and `{domain, path, surface}` from §2, plus `audible` and
   `incognito`; `title` only when `storeTitles`. Never the query or fragment.
3. **`active-time`**: events are cut to the time not covered by AFK events
   with status `afk`; web events with `audible: true` are kept whole. Output in
   timestamp order, zero-length pieces dropped.
4. **`categorise`**: §9.
5. **`pulse`** = `round(Σ(seconds × level) / (Σ seconds × 100) × 100)`, rounding
   half up; identical to RescueTime's `Σ(s × k) / (Σ s × 4) × 100` with
   `k = level / 25`. `null` when Σ seconds is 0. Only non-idle time enters.
6. **`blocks`**: each attributed event is cut at UTC 5-minute boundaries and
   summed per `(blockStart, source, activityKey, categoryPath, level)`. With
   `syncActivityKey` off, `activityKey` is null and keys are merged. If one
   device's blocks in a `blockStart` exceed 300 s they are scaled by the
   largest-remainder rule of step 9. Blocks carry no title, URL or path
   (enforced by the schema). Output sorted by `blockStart`, `deviceId`,
   `activityKey` (null first), `categoryPath`.
7. **`daily-totals`**: intervals are split at local midnight in the time zone
   (days last 23, 24 or 25 hours); per local date: total seconds, seconds by
   level and the pulse. Only dates with time appear, ascending.
8. **`browser-dedupe`** (macOS, one aggregator per device). Window events of a
   browser app (`browserApps`) minus the union of web events are uncovered
   time. Uncovered time up to `extensionLastHeartbeatAt + staleAfterSeconds`
   is `browser-unknown` (source `app`, neutral); later uncovered time (a
   silent extension) is attributed to the browser app itself. Web events become
   `web` segments with their domain; other window events stay `app` segments.
   Output sorted by start.
9. **`cross-device-cap`** (server). Per `blockStart`, if the devices' seconds
   add up to more than 300, each becomes `floor(s × 300 / total)` and the
   remaining seconds go one each to the largest fractional parts (ties by
   `deviceId`, `activityKey`, `categoryPath` ascending). Blocks that reach 0
   are dropped.

The guardian only ever sees per-level totals and the pulse.

## 11. Fixtures

- One case per file under `fixtures/<kind>/<spec_name>.json`; `id` is
  `<kind>.<spec_name>`, globally unique, and the test name in every runner.
- Kinds: `decision`, `specificity` (same shape), `url-normalize`, `schedule`,
  `escalation` (multi-step, each step feeds the previous state), `rule-change`,
  `activity`, and the reserved `unlock-token` (vectors live in
  `packages/protocol`). Android adds detector XML fixtures with its work
  package.
- A fixture with an unknown `kind`, an invalid shape, or filed under the wrong
  directory MUST fail the runner (`unknown_fixture_kind_fails_loudly`); nothing
  is skipped. TypeScript loads them with `loadFixtures(kind)`; Kotlin and Swift
  read the files by relative path and validate them against
  `schema/v1/fixture.schema.json`.

## 12. Pinned decisions

Points the plan left open, resolved conservatively:

1. `allow` rules compete on both axes, so an allow-listed subreddit beats
   hide-feed on the feed surface (`decision.allow_listed_subreddit_is_shown`).
2. One `ruleId`/`reason` per decision, chosen by §5.4.
3. Friction groups are rule ids; intention, escalation and emergency override
   share one state per group (§7) instead of separate intention records.
4. The escalation window is a session that resets after 2 quiet hours (the
   stricter reading of "2 h rolling window"); no reset at local midnight.
5. L3 with a guardian pauses 15 s and also asks for a typed intention.
6. The friction type is the successor of the previous one, so it never repeats,
   even across sessions.
7. An extension's pause skips typing and the guardian key, then grants 5
   minutes.
8. Emergency overrides are scoped to one group (`bedtime` for bedtime);
   unlocks are scoped by target and lift bedtime too.
9. Budgets apply from any matching candidate, on either axis; usage of another
   local date is ignored.
10. Path matching is ASCII case-insensitive; a path rule never matches an
    unknown path; `**` matches zero segments.
11. Rule-change: anything not provably tightening waits; `workHours` changes
    always wait.
12. Analytics durations are whole seconds; pulse rounds half up; capping uses
    the largest remainder.
13. `start == end` in a schedule means 24 hours.
