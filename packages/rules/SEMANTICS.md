# Rules semantics (v1, normative)

This document is the contract every engine implements: `packages/engine`
(TypeScript), Android `:core-domain` (Kotlin) and macOS `MonkiCore` (Swift).
The fixtures under `fixtures/` are the executable form of this text. When the
text and a fixture disagree, it is a bug in one of them: fix it in a pull
request that changes both. The key words MUST, MUST NOT and SHOULD are used as
in RFC 2119.

All functions below are **pure**: the clock (`now`) and every input are
parameters. No I/O, no implicit time, and **no device time zone**: the zone is
the rule set's pinned `timeZone` (§6.3).

## 1. Conventions

- **Instants** in inputs (`now` included) MUST be RFC 3339 with an explicit
  offset or `Z` and whole seconds (the schema pattern); a floating local time
  is invalid input. Every instant an engine **computes** (escalation state, rule-change
  `effectiveFrom`, analytics) is written in UTC with `Z` and no fractional
  seconds (`2026-10-25T23:00:00Z`), so fixture comparison is a string compare.
- **Local time** means the wall clock in the pinned IANA time zone. Days of
  the week, local dates and schedules are always evaluated in local time.
- **Intervals** are half-open: `[start, end)`.
- **String order** is code-unit (ASCII) order. Rule ids, surface ids and
  activity keys are ASCII by schema, so every platform sorts them identically.
- **Arrays in `then`** are written in a defined order (stated per operation);
  runners compare them in order unless a section says "as a set".
- **Limits.** Every document (rule set, site profile, detector pack, fixture)
  MUST be rejected when its UTF-8 serialisation exceeds 256 KiB, when it has a
  field the schema does not define (`additionalProperties: false`
  everywhere), when it fails its schema, or when an array marked
  `x-uniqueBy: <pointer>` has two items with an equal value at that JSON
  pointer (rule ids, category targets, escalation groups, surface ids). Site
  targets are compared **normalised** (§3.1 domain, glob lower-cased, `/**`
  dropped), so `www.reddit.com` and `reddit.com`, or `twitter.com` and
  `x.com`, are duplicates. A domain marked `x-registrableDomain` MUST keep two
  labels after normalisation and MUST NOT be a bare public suffix (two labels
  under a two-letter TLD with second label `ac`, `co`, `com`, `edu`, `gov`,
  `net` or `org`): `m.me` and `www.co.uk` are rejected. A time zone marked
  `x-timeZone` MUST resolve in the platform's time zone database, matched
  case-sensitively (links such as `Asia/Calcutta` are fine): `Mars/Olympus`
  is rejected. Every platform's validator enforces these keywords and reports
  a rejection code (`schema`, `duplicate_key`, `invalid_domain`,
  `invalid_time_zone`, `too_large`, `invalid_json`), checked by the `invalid`
  fixtures (§12). Data contains literals, globs and view ids
  only, never regular expressions or code.

## 2. URL normalisation (`url-normalize`)

`normalizeUrl(urlText, siteProfiles) → {host, path, pathKnown, surface} | {rejected}`

1. Trim surrounding whitespace.
2. **Scheme.** The text has a scheme when it starts with
   `[A-Za-z][A-Za-z0-9+.-]*:` and the part before `:` contains no `.`. A scheme
   other than `http`/`https` (case-insensitive) → `{rejected: "not_http"}`.
   Without a scheme, prepend `https://`.
3. **pathKnown** starts `false` iff the original text had no scheme and
   contains none of `/`, `?`, `#` (a bare domain, as mobile URL bars show
   it). Otherwise `true` (step 7 can still clear it).
4. Parse with WHATWG URL semantics. User info, port, query and fragment are
   discarded.
5. **Host:** lower-case ASCII (IDN → punycode), drop one trailing `.`, then
   drop one leading `www.` or `m.` label. The result MUST be a domain with at
   least two labels and an alphabetic or punycode TLD; otherwise (IP
   addresses, `localhost`) → `{rejected: "invalid_host"}`.
6. **Aliases:** if the host equals an alias of a site profile, or ends with
   `.` + that alias, replace that alias suffix with the profile's `domain`
   (`twitter.com` → `x.com`, `mobile.twitter.com` → `mobile.x.com`).
7. **Path:** the parsed path split on `/`, empty segments dropped, re-joined
   with a leading `/`; the root is `/`. In each segment, escapes of
   **unreserved** characters (`A-Z a-z 0-9 - . _ ~`) are decoded and the hex
   digits of every other escape are upper-cased (`%73horts` → `shorts`,
   `caf%c3%a9` → `caf%C3%A9`). If a segment still contains `%2F`, or decodes
   to `.` or `..`, or contains `;` (never stripped: matrix parameters cannot
   disguise a path), `pathKnown` becomes `false` (the path is kept for
   display). Case is otherwise kept. No trailing slash.
8. **Surface:** `null` when `pathKnown` is false. Otherwise find the profile
   whose `domain` equals the host or is a dot-suffix of it; among its globs
   that match the path (§3.2), the most specific wins (§4 steps 2 and 4, then
   surface id ascending). No match → `null`.

## 3. Targets and matching

### 3.1 Targets

Rule, category and unlock **domains are normalised like hosts** before any
matching (§2 steps 5–6: `www.`/`m.` dropped, aliases rewritten), so a rule on
`twitter.com` or `www.reddit.com` acts on `x.com` or `reddit.com`; the schema
accepts them as written. Domain labels for §4 are counted after
normalisation.

- `{kind: "app", package}` matches an app observation with the same package
  (Android package name or macOS bundle id).
- `{kind: "site", domain, path?}` matches a site observation whose host equals
  `domain` or ends with `.` + `domain`. A path of `/**` matches every path,
  also an unknown one. With another path, the glob must match the observed
  path; such a target never matches when `pathKnown` is false (but see §5.5).
  For ranking (§4, §9) a glob **without literal segments** (`/**`, `/*`,
  `/*/**`, …) counts as no path.
- `{kind: "surface", surface}` matches any observation whose resolved surface
  equals it: on the web from the site profile (§2.8), in an app from the
  detector (`AppObservation.surface`). One surface rule therefore acts on the
  app and the web alike.

### 3.2 Path globs

A glob is `/`, or `/`-separated segments where each segment is a literal, `*`
(exactly one segment) or a final `**` (zero or more segments). `/reels/**`
matches `/reels`, `/reels/a` and `/reels/a/b`; `/r/*` matches `/r/x` but not
`/r/x/comments`. Literal segments compare **ASCII case-insensitively**. There
are no partial wildcards (`/r/foo*` is invalid) and no `%` escapes (rejected
rather than decoded, so a glob means exactly what it says).

## 4. Specificity

Among candidates on one axis, the most specific wins. Compare in order; the
first difference decides:

1. **Refinement:** surface target, or site target with a path that has at
   least one literal segment = 1; app target or site target without such a
   path = 0. Higher wins.
2. **Literal path segments** (site targets with a path; 0 otherwise). More
   wins. A path without literal segments counts 0 here and in step 4.
3. **Domain labels** (site targets; 0 otherwise). More wins
   (`old.reddit.com` over `reddit.com`).
4. **Wildcards** (`*` and `**` count 1 each). Fewer wins.
5. **Stricter mode:** `block > friction > hide-feed > allow`.
6. **Rule id**, code-unit ascending: the smallest id wins (determinism only).

"R outranks Q" means R wins against Q under this order.

## 5. Decision (`decision`, `specificity`)

`decide(ruleset, observation, state, now) → Decision`

### 5.1 Candidates

A rule is a candidate when `enabled` is true, its schedules are active at
`now` (§6, in the pinned zone and, while a time-zone change waits, §6.3) and
its target matches the normalised observation. A site observation that
normalises to `rejected` matches no rule and has category level 50. Two
independent axes then choose a winner each with §4:

- **access** candidates: modes `allow`, `friction`, `block`;
- **content** candidates: modes `hide-feed` and `allow` (an allow rule speaks
  for both axes).

### 5.2 Access axis

Restrictions are checked in this order. Each one either **applies** (the
decision is final) or is **lifted** (continue with the next):

1. **Bedtime**: phase `active` (§6.2) and the observation's category level
   (§9, `includeDefaults` true; §5.5 when the path is unknown) is ≤ 25 →
   `block`, reason `schedule_bedtime`, `ruleId` null. No rule lifts it.
2. **Budget**: any candidate on either axis whose `dailyBudgetMinutes` is set
   and `state.usage.secondsByRule[rule.id] ≥ dailyBudgetMinutes × 60` →
   `block`, reason `budget_exhausted`, `ruleId` = that rule (several: the most
   specific by §4). `usage` is ignored unless `usage.localDate` is today's
   date in the pinned zone (in either zone while a zone change waits, §6.3),
   so a budget block lasts until local midnight. Usage accrues (in the
   adapter) to **every** matching candidate that carries a budget, not only
   the winner, so adding a more specific rule never hides a spent budget.
   Hide-feed rules take no budget (schema).
3. **Rule block**: access winner with mode `block` → `block`, `rule_match`.
4. **Friction**: access winner with mode `friction` → `gate`, reason
   `intention_required`, with the gate of §7.4.

Lifts, tried in this order for each restriction:

- a **verified unlock** whose `target` matches the observation and
  `notBefore ≤ now < expiresAt` lifts any restriction → reason
  `unlock_active`;
- an **emergency override**: the escalation state of the restriction's group
  (the rule id, or `bedtime` for bedtime) has phase `override_active` and
  `now < overrideEndsAt` → reason `emergency_active`;
- an **intention** (friction only): the group's state has phase `active` and
  `now < intentionExpiresAt` → reason `intention_active`. Leaving an intention
  early (`leave`) ends it: it no longer lifts anything.

If every restriction that matched was lifted, access is `allow` with the
reason of the lift of the **first** (highest-precedence) lifted restriction
and that restriction's `ruleId` (null for bedtime). If no restriction matched:
access winner `allow` → `allow`, `rule_match`; no access winner → `allow`,
`no_rule`. Unlocks are verified by adapters (signature, device, replay) before
they reach the engine; the engine only checks time and target.

### 5.3 Content axis

No content winner → `show`. Winner with mode `allow` → `show`. Winner with
mode `hide-feed`:

- `pathKnown` false → `show` (`path_unknown_allow`: never risk a permalink;
  access is handled by §5.5);
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

`explanationKey` is fixed by the primary outcome: for `rule_match` it is
`decision.blocked_by_rule` when access is `block`, else
`decision.feed_hidden` when content is `hide-feed`, else
`decision.allowed_by_rule`; every other reason maps to `decision.<reason>`.
`gate` is present iff access is `gate`. The domain never returns text.

### 5.5 Unknown path never fails open

When `pathKnown` is false (bare domain, encoded slash), the **unknown-path
candidates** are the enabled, scheduled rules whose target is a site whose
domain matches the host (any path) or a surface of the host's site profile.
Their effective access mode is the rule's mode, except that a `hide-feed`
rule counts as `friction` when it can cover a `feed` surface of that profile
(a site rule of the domain, or a surface rule on a feed surface), and a
surface `block` counts as `friction` too (remove the feed, not the tool; a
site `block` stays a block). The access winner is the unknown-path candidate
with the strictest effective mode (`block > friction > allow`; ties by §4,
with step 5 using the rule's own mode, not the effective mode).
`block` → `rule_match`; `friction` → the gate of its group (a promoted rule
is its own group). All unknown-path candidates take part in the budget step
(§5.2.2). For
bedtime the category level is the **minimum** level over all assignments
(user and default) of that domain: site targets of the domain with any path
and surface targets of its profile (`youtube.com` counts as 0 because of
Shorts). No assignment → 50. The content axis shows (§5.3).

## 6. Schedules and bedtime (`schedule`)

### 6.1 Schedules

A schedule `{days, start, end}` defines, for each listed day `d`, the window
`[d + start, d + start + length)` in **local wall-clock minutes**, where
`length = (end − start) mod 24 h`, and `0` means 24 hours. A window that
crosses midnight belongs to the day it **starts** on and spills into the
next. A schedule is active at `now` when `now`'s local wall time falls in one
of its windows (check the windows of the previous, current and next local
day). Wall-clock arithmetic makes DST transitions harmless: a window that
starts in the spring-forward gap begins at the first existing minute, a
window wholly inside the gap does not occur that day, and the repeated
fall-back hour is inside a window both times. Australia/Sydney 2026: DST
ends Sunday 5 April (03:00 AEDT → 02:00 AEST) and starts Sunday 4 October
(02:00 AEST → 03:00 AEDT).

**Week sets.** For comparisons (§8, §5 overlaps) a list of schedules is the
set of minutes it covers on the 10 080-minute week starting Monday 00:00,
with windows wrapping from Sunday into Monday. Empty schedules = the whole
week. `{mon 00:30–07:00}` is therefore not contained in `{mon 22:30–07:00}`
(Monday 22:30 to Tuesday 07:00).

### 6.2 Bedtime

`bedtimePhase(bedtime, now, timeZone) → inactive | warning | active`.
Disabled → `inactive`. `active` inside a window built like §6.1 from
`days/start/end`; otherwise `warning` inside
`[start − warnMinutesBefore, start)` of a listed day (wall-clock minutes);
otherwise `inactive`. The starter preset uses 22:30–07:00 every day with a
30-minute warning (from 22:00).

### 6.3 Pinned time zone

`ruleset.timeZone` (IANA, required) is the only zone: schedules, bedtime,
budget dates and rule-change midnights use it; the device zone is never an
input, so travelling or changing the device clock zone changes nothing. A
change of `timeZone` waits (§8). While it waits the effective rule set
carries `pendingTimeZone`, and every schedule and bedtime is evaluated in
**both** zones with the stricter outcome winning: a restrictive rule or
bedtime is active when it is active in either zone, an `allow` rule only when
it is active in both. A budget's usage counts when its `localDate` is
today's date in either zone, so a move to a zone behind never grants an extra
budget day. The starter preset
ships with `UTC`; clients set the device zone once at install.

## 7. Escalation (`escalation`)

`nextEscalation(state, event, now, guardianLinked) → {state, effects}`.
One state per **target group**: the id of the friction rule (or the blocked
rule / `bedtime` for emergency overrides; `bedtime` is reserved, so no rule
may use it as its id). The initial state is `idle` with
counters 0, `pendingExtension` false and every other field null. Events that
do not apply in the current phase leave the state unchanged; every event that
changes the state sets `lastActivityAt = now`.

### 7.1 Gates

`level = min(attemptCount − 1, 3)`. Base pause: L0 5 s, L1 15 s, L2 15 s, L3
15 s with a linked guardian, 60 s without.
`pauseSeconds = min(base << min(brokenCount, 4), 60)`. `requiresTypedIntention`
from L2; `requiresGuardianKey` only at L3 with a linked guardian. Without a
guardian L3 is therefore 60 s plus a typed intention. Counters saturate at
their schema caps: `attemptCount` stays at 1000 and `brokenCount` at 16.

**Friction type** rotates `countdown → breath → reflect → type-intention →
countdown`, starting with `countdown` when `lastFrictionType` is null, and is
always the successor of `lastFrictionType`, which survives session resets: it
never repeats twice in a row.

### 7.2 Session

Attempts count in a session that resets when a `visit` arrives at least
2 hours (7200 s) after `lastActivityAt` (the last escalation event of any
kind, not only the last gate): `attemptCount` and `brokenCount` return to 0
before the new attempt is counted. There is no reset at local midnight. At
most two extensions per session (`brokenCount` before the event < 2) get the
short extension path; the third and later require a full gate.

### 7.3 Transitions

- **`visit`** from `idle`, or from `active` / `override_active` whose time is
  over: session check (§7.2), `attemptCount += 1`, `lastAttemptAt = now`, new
  gate (§7.1), `lastFrictionType` = its type, `pauseEndsAt = now + pause`,
  phase `pausing`, other timers null. In `pausing`, `asking`, `timed_out`,
  `override_waiting` and a current `active` / `override_active` it changes
  nothing (reloading never resets a pause).
- **`pause_elapsed`** in `pausing` with `now ≥ pauseEndsAt`: `asking`; with
  `pendingExtension`: `active`, `intentionExpiresAt = now + 300 s`, gate and
  pause cleared.
- **`close`** in `pausing`, `asking`, `override_waiting`: `idle`; gate, pause,
  extension and override timers cleared (the attempt still counts).
- **`commit`** in `asking`: `active`, `intentionExpiresAt = now + minutes`;
  ignored when typing is required and `typedWords < 3`, or the guardian key is
  required and not verified.
- **`intention_expired`** in `active` with `now ≥ intentionExpiresAt`:
  `timed_out`.
- **`leave`** in `active` or `timed_out`: `idle`; the intention ends and
  `intentionExpiresAt` becomes null (the attempt still counts).
- **`extend`** in `timed_out`: `brokenCount += 1`; the next friction type;
  phase `pausing`. If `brokenCount` was < 2: the gate at the current level
  with the doubled pause and no typing or key, `pendingExtension` true (then 5
  minutes). Otherwise a **full gate** at the current level (typing and key as
  §7.1), `pendingExtension` false (then `asking` and a new `commit`).
- **`emergency_request`** in `idle`, `pausing`, `asking`, `active`,
  `timed_out` (every phase in which `decide` can gate or block, so the user is
  never trapped; `active` matters when a budget runs out mid-intention):
  `override_waiting`, `overrideReadyAt = now + 120 s`. From `active` the
  intention ends (`intentionExpiresAt` becomes null).
- **`emergency_wait_elapsed`** in `override_waiting` with
  `now ≥ overrideReadyAt`: `override_active`,
  `overrideEndsAt = now + 15 min`, effect `record_bypass` (always reported to
  the guardian, queued while offline).
- **`emergency_expired`** in `override_active` with `now ≥ overrideEndsAt`:
  `idle`, override timers cleared.

Every transition to `idle` clears `gate`, `pauseEndsAt`, `pendingExtension`
(false), `intentionExpiresAt`, `overrideReadyAt` and `overrideEndsAt`; only
the counters, `lastAttemptAt`, `lastActivityAt` and `lastFrictionType` survive.

### 7.4 Gate in `decide`

For a friction restriction without a lift, `decide` returns:

- in `pausing` or `asking`: the state's current `gate`;
- in `timed_out` or `override_waiting` (where a `visit` changes nothing): the
  **current gate** without a new attempt: level `min(max(attemptCount − 1, 0), 3)`,
  pause from `brokenCount`, friction type `lastFrictionType` (or `countdown`);
- otherwise the gate a `visit` would produce now, computed on the **effective
  state**: escalation is shared by every matching friction candidate, so a new
  rule id never resets it. For each matching friction candidate's group apply
  the session check of §7.2; the effective `attemptCount` and `brokenCount`
  are the maxima, `lastFrictionType` comes from the group with the latest
  `lastActivityAt` (ties: the winner's group, then the smallest rule id,
  code-unit order). Adapters MUST call `nextEscalation`
  for the winner's group with that effective state, so the stored gate equals
  the returned one.

## 8. Rule changes (`rule-change`)

`effectiveRuleSet(old, new, now, pendingEffectiveFrom) → {effectiveToday, effectiveFrom}`.
`old` MUST be the currently effective rule set; a new change replaces any
pending one and never moves an existing `effectiveFrom` earlier. A change that
only **tightens** applies at once; anything else (loosening, or not provably
tightening) waits. Each part is judged on its own:

- **Rules, by id.** Added: tightening iff enabled, mode ≠ `allow` and it
  passes the **outrank check**. Removed: tightening iff it was an enabled
  `allow` rule without a budget. Modified: tightening iff every changed field
  tightens: target unchanged; `enabled` false → true for a non-allow rule
  (outrank check), or true → false for an allow rule without a budget
  (removing or disabling any rule that carries a budget waits); mode `allow → any`, `friction → block`,
  `hide-feed → block`; schedules whose week set (§6.1) contains the old one on
  a non-allow rule (outrank check when it grows); budget added or lowered
  (raised or removed waits); `note` is neutral. A `{"ref": "workHours"}`
  schedule resolves to `old.workHours` in the old rule and to the work hours
  that apply **today** in the new one (`old.workHours` while a `workHours`
  change waits, otherwise `new.workHours`): moving a rule to work hours while
  widening them waits.
- **Outrank check.** A rule that becomes active where it was not (added,
  enabled, schedule widened) is tightening only if, at every instant it is
  active, it does not outrank (§4, access axis) an overlapping rule of
  `effectiveToday` with a stricter mode (`block` above `friction`). The check
  runs against the rule set that would actually apply now (`old` plus only the
  immediately applicable parts of `new`) and is iterated to a fixed point:
  start from every part that tightens by the field rules, send back to waiting
  any rule that fails the check, and repeat until nothing changes. Two rules
  overlap when their week sets intersect and their **normalised** targets
  (§3.1: aliases, `www.`, `m.`, case-insensitive globs) can match a common
  observation: same package; sites whose domains are equal or one is a
  dot-suffix of the other (paths ignored); the same surface; a site and a
  surface of that site's profile; an app and any surface. Otherwise it waits
  (a friction rule more specific than a block would turn the block into a
  gate).
- **Bedtime:** tightening iff it becomes enabled, or stays enabled with
  `days` and window whose week set contains the old one.
  `warnMinutesBefore` is neutral.
- **workHours** and **timeZone:** any change waits. A waiting `timeZone`
  change sets `effectiveToday.timeZone = old.timeZone` and
  `effectiveToday.pendingTimeZone = new.timeZone` (§6.3).
- **Categories, by target:** tightening iff present in both with a level that
  is lower or equal; any other change waits.

`effectiveToday` is `new` with every waiting part replaced by its `old`
version (added loosening rules left out, removed restrictive rules kept), with
`new`'s `revision` and `updatedAt`, rules sorted by id. When nothing waits,
`effectiveFrom` is null and `effectiveToday` equals `new`. Otherwise
`effectiveFrom` is computed as:

1. the next local midnight after `now` (with a waiting `timeZone` change, the
   later of the next midnights in both zones);
2. the first instant at or after that one that lies in no old window of a
   waiting part (in either zone): the end of the union of the half-open
   windows that chain from it, however many there are. It is a time bound,
   never a round count, and never later than `now` + 8 days (691 200 s): if
   the union still covers that instant (24-hour windows on every day never
   end), the result is exactly `now` + 8 days. The old windows of the waiting
   parts are (an old bedtime window only while the old bedtime is enabled; a
   `workHours` reference resolves to the old `workHours`):
   - bedtime or categories (they decide bedtime): the old bedtime window;
   - a rule whose `schedules` changed, and an enabled non-allow rule that is
     removed or disabled: its old schedule windows (deleting a block during
     its window waits until the window ends); a rule without schedules has
     no window;
   - `workHours`: the old `workHours` window;
   - `timeZone`: the old bedtime window and the schedule windows of every
     enabled old rule;
3. never earlier than `pendingEffectiveFrom`.

The result is a UTC instant (turning bedtime off at 23:00 takes effect at
07:00, not at midnight). Runners compare rules as a set keyed by id.

## 9. Categories

`categorise(activity, assignments, includeDefaults) → {level, categoryPath}`.
Candidates: the rule set's `categories` and, when included,
`data/categories/default.json`, matched like rule targets (§3; an activity is
`{source, activityKey, path, surface}` where `activityKey` is the normalised
domain or the package; `path` null when unknown). The most specific wins by §4
steps 1–4 (a path without literal segments counts as no path); on a full tie a user assignment beats a
default, then the lower level, then list order. No match →
`{level: 50, categoryPath: "uncategorised"}`. Levels are 0, 25, 50, 75, 100
(RescueTime −2..2 scaled; 0 = very distracting). `decide` always includes the
defaults; with an unknown path it uses §5.5.

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
   `activityKey` (null first), `categoryPath`, `source`, `level` (ascending;
   strings in code-unit order), a total order.
7. **`daily-totals`**: intervals are split at local midnight in the time zone
   (days last 23, 24 or 25 hours); per local date: total seconds, seconds by
   level and the pulse. Only dates with time appear, ascending.
8. **`browser-dedupe`** (macOS, one aggregator per device). Window events of a
   browser app (`browserApps`) minus the union of web events are uncovered
   time. The extension's known heartbeats are the end of every web event
   (`timestamp + duration`) and `extensionLastHeartbeatAt` (when not null).
   An uncovered instant `t` is `browser-unknown` (source `app`, neutral) when
   the latest known heartbeat at or before `t` is less than
   `staleAfterSeconds` earlier (`h ≤ t < h + staleAfterSeconds`); otherwise
   (a silent extension, or no heartbeat yet) it is attributed to the browser
   app itself. Each stretch is judged against its own latest heartbeat, never
   against one global `extensionLastHeartbeatAt`: a later heartbeat does not
   cover earlier silence. Web events become `web` segments with their domain
   and are **not** clipped to browser-window time; other window events stay
   `app` segments. Output sorted by start, then end, `source` and
   `activityKey`.
9. **`cross-device-cap`** (server). Per `blockStart`, if the devices' seconds
   add up to more than 300, each becomes `floor(s × 300 / total)` and the
   remaining seconds go one each to the largest fractional parts (ties by
   `deviceId`, `activityKey` (null first), `categoryPath`, `source`, `level`
   ascending, a total order). Blocks that reach 0 are dropped.

The guardian only ever sees per-level totals and the pulse.

## 11. Detector packs (Android)

Detectors of a pack run by descending `priority`; equal priorities are
ordered by surface id ascending. A surface applies when every `all`
predicate, at least one `any` predicate (when present, never empty) and no
`none` predicate match; each predicate names a `viewId`, `text` or
`contentDesc`, and all its fields must hold on the same node. A predicate
that compares `text` or `contentDesc` also names a `viewId`. Short view ids
are prefixed with the package on screen (`<package>:id/<id>`); only a
compiled list of Compose test tags (`ADDRESSBAR_URL_BOX`) also matches a
resource id without a package. Only nodes of the screen's own package count,
and nothing below a WebView (page content chooses its own ids and text).
Text comparisons are literal and case-sensitive.

A screen read is bounded (2,500 nodes, depth 40). When a bound cuts it
short, detectors with a `none` list and the allow-only surfaces
(`*.reel_from_dm`, `*.stories`, `*.direct`) never match. A `reel_from_dm`
match is kept only when the previous classified surface was the family's
`direct` at most 5 s earlier or it continues the same DM reel session, for
at most 120 s; otherwise it is the family's `reels`.

`packVersion` (`YYYY.MM.DD.n`, a real calendar date, `n` without leading
zeros) is compared numerically component by component (`2026.10.25.10` >
`2026.10.25.9`). A downloaded pack is accepted only when signed, free of
duplicate JSON keys, valid, within the compiled package allowlist and
invariants, not revoked, dated at most 2 days after the trusted time, its
`minSchemaVersion` is supported and it is newer than both the installed pack
and the version bundled with the build. `unclassifiedCapMinutes`: when a
package has an enabled surface `block` rule and its screens went
unclassified for at least this many minutes within the last 2 × that many
minutes of foreground time (a sliding window: short classified blips and app
switches do not reset it), the engine treats the package as having
app-level `friction` while it stays unclassified (0 = off; Instagram and
YouTube at least 5).

## 12. Fixtures

- One case per file under `fixtures/<kind>/<spec_name>.json`; `id` is
  `<kind>.<spec_name>`, globally unique, and the test name in every runner.
- Kinds: `decision`, `specificity` (same shape), `url-normalize`, `schedule`,
  `escalation` (multi-step, each step feeds the previous state), `rule-change`,
  `activity`, `invalid` (a document with the schema it targets and the
  expected `{rejected: true, code}`), and the reserved `unlock-token`
  (vectors live in `packages/protocol`). Kotlin and Swift runners MUST run the
  `invalid` kind as well, and generate the oversized (> 256 KiB) case
  themselves: it is never committed. Android adds detector XML fixtures with its work
  package.
- A fixture with an unknown `kind`, an invalid shape, or filed under the wrong
  directory MUST fail the runner (`unknown_fixture_kind_fails_loudly`); nothing
  is skipped. TypeScript loads them with `loadFixtures(kind)`; Kotlin and Swift
  read the files by relative path and validate them against
  `schema/v1/fixture.schema.json` (including `x-uniqueBy`).

## 13. Pinned decisions

Points the plan left open, resolved conservatively (the master's review
decisions are folded into the sections above):

1. `allow` rules compete on both axes, so an allow-listed subreddit beats
   hide-feed on the feed surface (`decision.allow_listed_subreddit_is_shown`).
2. One `ruleId`/`reason` per decision, chosen by §5.4.
3. Friction groups are rule ids; intention, escalation and emergency override
   share one state per group (§7) instead of separate intention records.
4. The escalation window is a session that resets after 2 quiet hours since
   the last escalation event; no reset at local midnight.
5. L3 with a guardian pauses 15 s and also asks for a typed intention.
6. The friction type is the successor of the previous one, so it never
   repeats, even across sessions.
7. Emergency overrides are scoped to one group (`bedtime` for bedtime);
   unlocks are scoped by target and lift bedtime too.
8. Budgets apply from any matching candidate, on either axis.
9. Path matching is ASCII case-insensitive; `**` matches zero segments.
10. Analytics durations are whole seconds; pulse rounds half up; capping uses
    the largest remainder.
11. `start == end` in a schedule means 24 hours.
12. Reddit user pages are `reddit.user_feed` (feed), multireddits are
    `reddit.feed`; YouTube subscriptions (`youtube.subscriptions`) and
    explore/trending/hashtags (`youtube.explore`) are feeds; Instagram Explore
    search is `instagram.search` (utility). The starter preset hides
    `youtube.explore` but not subscriptions or user pages.

## 14. Failure handling

- **Fail closed.** Any exception or invalid input while computing `decide`
  (an input that fails its schema, an unresolvable time zone, an instant
  without an offset, an internal error) yields
  `{access: block, content: hide-feed, ruleId: null, reason: engine_error,
explanationKey: decision.engine_error}` and no gate. Adapters log the
  reason code only, never URLs or titles.
- **Validated inputs.** Rule sets are validated (§1) before they reach an
  engine; an unknown time zone is rejected with `invalid_time_zone`, so at
  run time it can only come from a bug and fails closed as above.
- **Ids are data.** Lookups by rule id, target group or usage key MUST use
  maps or own-property checks and never reach an object prototype:
  `constructor`, `toString` or `hasOwnProperty` are ordinary ids
  (`decision.rule_ids_named_like_object_members_are_plain_ids`).
