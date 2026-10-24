// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SessionRulesApi } from './GateRedirectRules'

/** Session rule ids of the per-tab passes: `[FIRST, FIRST + MAX_PASSES)`. */
export const PASS_RULE_FIRST_ID = 20_000
export const MAX_PASSES = 1_000
/** A pass the tab never used is dropped after this long. */
export const PASS_LIFETIME_MS = 60_000

/** `storage.session` key of the passes' bookkeeping. */
export const TAB_PASSES_NAME = 'gate.passes'
/**
 * Longer URLs get no pass (a regex literal that long risks Chromium's 2 KB
 * regex budget, and a host-wide pass would let other pages through): they
 * go through the gate on every redirect.
 */
const MAX_EXACT_URL_LENGTH = 1_000

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

interface PassRecord {
  ruleId: number
  tabId: number
  createdAt: number
}

function isPassList(value: unknown): value is PassRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as PassRecord).ruleId === 'number' &&
        typeof (entry as PassRecord).tabId === 'number' &&
        typeof (entry as PassRecord).createdAt === 'number'
    )
  )
}

function escapeRegex(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
}

function isPassRuleId(id: number): boolean {
  return id >= PASS_RULE_FIRST_ID && id < PASS_RULE_FIRST_ID + MAX_PASSES
}

/** Whether `url` can get an exact pass. */
export function canPass(url: string): boolean {
  return url.length <= MAX_EXACT_URL_LENGTH
}

/**
 * One-off passes through the gate's redirect: when the engine allows the
 * page a tab was redirected from (an allowed community inside a gated site,
 * an intention just committed), or the gate's search box opens a search, an
 * `allow` session rule of higher priority than the redirects lets exactly
 * that URL load in exactly that tab. The pass goes once the tab has loaded a
 * page, when the tab closes, or after a minute unused (`sweep` runs on
 * start and on the alarms). Exact URLs only, never a whole host.
 */
export class TabPasses {
  private lock: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly dnr: SessionRulesApi,
    private readonly storage: StorageArea,
    private readonly now: () => number
  ) {}

  /** Lets `url` load once in `tabId` (replacing the tab's earlier pass); false when it is too long. */
  grant(tabId: number, url: string): Promise<boolean> {
    return this.exclusive(async () => {
      if (!canPass(url)) return false
      const passes = await this.live()
      const stale = passes.filter((pass) => pass.tabId === tabId)
      const kept = passes.filter((pass) => pass.tabId !== tabId)
      const used = new Set(kept.map((pass) => pass.ruleId))
      let ruleId = PASS_RULE_FIRST_ID
      while (used.has(ruleId) && ruleId < PASS_RULE_FIRST_ID + MAX_PASSES) ruleId += 1
      await this.dnr.updateSessionRules({
        removeRuleIds: [...new Set([...stale.map((pass) => pass.ruleId), ruleId])],
        addRules: [
          {
            id: ruleId,
            priority: 2,
            action: { type: 'allow' },
            condition: {
              tabIds: [tabId],
              regexFilter: `^${escapeRegex(url)}$`,
              resourceTypes: ['main_frame'],
            },
          },
        ],
      })
      await this.save([...kept, { ruleId, tabId, createdAt: this.now() }])
      return true
    })
  }

  /** Removes expired passes and pass rules nobody keeps track of (a lost bookkeeping). */
  sweep(): Promise<void> {
    return this.exclusive(async () => {
      const live = await this.live()
      const tracked = new Set(live.map((pass) => pass.ruleId))
      const orphans = (await this.dnr.getSessionRules())
        .map(({ id }) => id)
        .filter((id) => isPassRuleId(id) && !tracked.has(id))
      if (orphans.length > 0) await this.dnr.updateSessionRules({ removeRuleIds: orphans })
      await this.save(live)
    })
  }

  /** The tab loaded a page or closed: its pass is spent. */
  revoke(tabId: number): Promise<void> {
    return this.exclusive(async () => {
      const passes = await this.read()
      const gone = passes.filter((pass) => pass.tabId === tabId)
      if (gone.length === 0) return
      await this.dnr.updateSessionRules({ removeRuleIds: gone.map((pass) => pass.ruleId) })
      await this.save(passes.filter((pass) => pass.tabId !== tabId))
    })
  }

  /** Passes still within their lifetime; expired ones are removed from the browser. */
  private async live(): Promise<PassRecord[]> {
    const passes = await this.read()
    const cutoff = this.now() - PASS_LIFETIME_MS
    const expired = passes.filter((pass) => pass.createdAt < cutoff)
    if (expired.length > 0) {
      await this.dnr.updateSessionRules({ removeRuleIds: expired.map((pass) => pass.ruleId) })
    }
    return passes.filter((pass) => pass.createdAt >= cutoff)
  }

  private async read(): Promise<PassRecord[]> {
    const stored = (await this.storage.get(TAB_PASSES_NAME))[TAB_PASSES_NAME]
    return isPassList(stored) ? stored : []
  }

  private save(passes: PassRecord[]): Promise<void> {
    return this.storage.set({ [TAB_PASSES_NAME]: passes })
  }

  private exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lock.then(task)
    this.lock = run.catch(() => undefined)
    return run
  }
}
