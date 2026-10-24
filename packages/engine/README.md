# `@monki-focus/engine`

The pure TypeScript decision engine shared by the extension and the server.
It implements the normative semantics in
[`packages/rules/SEMANTICS.md`](../rules/SEMANTICS.md) and runs every shared
fixture of kinds `decision`, `specificity`, `url-normalize`, `schedule`,
`escalation`, `rule-change` and `invalid`. Categorisation and analytics
(`activity` fixtures) live in `@monki-focus/analytics`.

## API

```ts
import {
  createRulesCatalog,
  decide,
  effectiveRuleSet,
  isScheduleActive,
  bedtimePhase,
  nextEscalation,
  normalizeUrl,
} from '@monki-focus/engine'

// Built once by the adapter from @monki-focus/rules data (Node readers on the
// server, JSON imports in the extension bundle).
const catalog = createRulesCatalog({ siteProfiles, surfaces, defaultCategories })

normalizeUrl('https://www.reddit.com/r/AskHistorians/', catalog) // §2
decide(ruleset, observation, state, now, catalog) // §5 → Decision
nextEscalation(escalationState, event, now, guardianLinked) // §7 → {state, effects}
effectiveRuleSet(old, next, now, pendingEffectiveFrom, catalog) // §8 → {effectiveToday, effectiveFrom}
isScheduleActive(schedules, workHours, now, timeZone) // §6.1
bedtimePhase(bedtime, now, timeZone) // §6.2
```

Every input type comes from `@monki-focus/rules` (generated from the JSON
Schemas). Validate rule sets with the rules package validator first
(`@monki-focus/rules/pure` is the browser-safe entry point for the bundled
data, schemas and validator). When `decide` returns a gate computed from the
shared escalation of several friction rules (§7.4), the adapter passes
`effectiveEscalationState(...)` to `nextEscalation` so the stored gate equals
the returned one.

## Failure handling (§14)

Always build `now` with `instantOf(Date.now())`: it floors to whole seconds
and writes `YYYY-MM-DDTHH:MM:SSZ`. `new Date().toISOString()` carries
milliseconds, which is invalid input and fails closed on every decision.

`decide` fails closed: any exception or invalid input (garbage URL text, an
unknown observation, an instant without an explicit offset, an unresolvable
time zone, an internal error) returns `ENGINE_ERROR_DECISION`, i.e. `block`,
`hide-feed`, reason `engine_error`, no gate. Instants are parsed strictly
(RFC 3339 with `Z` or `±HH:MM`, never `Date.parse` leniency) and every input
instant is checked up front, so the outcome does not depend on which rule
reads it. Rule ids, target groups and usage keys are data: lookups use maps
and own-property checks, so `constructor` or `toString` are ordinary ids.
Adapters log the reason code only, never URLs or titles.

## Purity

`src/` takes the clock and every input as parameters: no `Date.now()`, no
`chrome.*`, no I/O and no Node or DOM APIs. ESLint enforces it for `src/`
(restricted globals, syntax and imports; only type imports from
`@monki-focus/rules`, whose runtime reads files) and the build compiles
`src/` without Node or DOM typings.

## Time zones

The only zone is the rule set's pinned `timeZone` (plus `pendingTimeZone`
while a change waits); the device zone is never read. Offsets come from
`Intl.DateTimeFormat` with an explicit `timeZone` (`formatToParts`, one cached
formatter per zone), which Chromium service workers and Node 24 both ship, so
no `Temporal` and no bundled tz database. Local time is handled as "wall
seconds" (seconds since 1970-01-01 00:00 local), which makes schedule
arithmetic plain integer arithmetic in wall-clock minutes. Turning a wall time
back into an instant (local midnight, the end of a window) tries the zone's
offsets around that wall time and, for a time inside a spring-forward gap,
binary-searches the transition: such a time resolves to the first existing
instant after the gap, and a repeated fall-back time to its next occurrence.
A waiting rule change runs to the end of the union of the old windows that
chain from the next local midnight, bounded by time: never more than 8 days
after `now` (§8 step 2).

## Scripts

```bash
npm test -w @monki-focus/engine        # fixtures, unit and property tests, coverage gate (95 %)
npm run lint -w @monki-focus/engine
npm run typecheck -w @monki-focus/engine
npm run build -w @monki-focus/engine   # dist/ with declarations
```
