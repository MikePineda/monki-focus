// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'preact/hooks'
import { TimeoutOverlay } from '../content/TimeoutOverlay'
import { useI18n } from '../i18n/I18nContext'
import type { SimpleKey } from '../i18n/t'
import type { Clock } from '../shared/clock'
import type { GateBlockReason, GateContext, GateView } from '../shared/GateContract'
import type { GateHandoff } from '../shared/messages'
import { Button } from '../ui/Button'
import { Countdown } from '../ui/Countdown'
import '../ui/PageShell.css'
import { TextField } from '../ui/TextField'
import '../ui/VisuallyHidden.css'
import type { GateClient } from './GateClient'
import './GatePage.css'
import { IntentionForm } from './IntentionForm'
import { PauseBlock } from './PauseBlock'

export interface GatePageProps {
  client: GateClient
  clock: Clock
  /** What the DNR redirect handed over (already removed from the address bar). */
  handoff: GateHandoff | null
  /** Moves the tab on (`location.replace`, so the gate leaves no history entry). */
  navigate: (url: string) => void
  /**
   * Last resort when the service worker cannot close the tab: the page
   * closes its own tab through the tabs API (a new tab first when it is the
   * last one), never `window.close()` of the window.
   */
  closeOwnTab: () => Promise<unknown>
}

const BLOCKED_TITLE: Readonly<Record<GateBlockReason, SimpleKey>> = {
  budget_exhausted: 'gate.blocked.budget',
  schedule_bedtime: 'gate.blocked.bedtime',
  rule_match: 'gate.blocked.rule',
  engine_error: 'gate.blocked.error',
}
const BLOCKED_WHY: Readonly<Record<GateBlockReason, SimpleKey>> = {
  budget_exhausted: 'gate.blockedWhy.budget',
  schedule_bedtime: 'gate.blockedWhy.bedtime',
  rule_match: 'gate.blockedWhy.rule',
  engine_error: 'gate.blockedWhy.error',
}

function contextOf(view: GateView | null): GateContext | null {
  return view !== null && 'context' in view ? view.context : null
}

/**
 * The intention gate (02 §8.1): a single centred column on `surface`, no
 * site branding. Close is the one accent action, enabled and focused from
 * the first frame, in every state; Emergency is always one step away while
 * something is gated or blocked. Everything shown is the service worker's
 * view of the engine's state; the page only counts down to stored times.
 */
export function GatePage({ client, clock, handoff, navigate, closeOwnTab }: GatePageProps) {
  const { t } = useI18n()
  const [view, setView] = useState<GateView | null>(null)

  const show = (next: GateView) => {
    if (next.kind === 'pass') navigate(next.url)
    setView(next)
  }
  const run = (task: () => Promise<GateView>) => {
    void task()
      .then(show)
      .catch(() => undefined)
  }

  useEffect(() => {
    void client
      .load(handoff)
      .then(show)
      .catch(() => setView({ kind: 'none' }))
    // The hand-off is read once, on the first frame.
  }, [])

  const close = () => {
    void client.close().catch(() => closeOwnTab().catch(() => undefined))
  }

  const context = contextOf(view)
  const contextLine = context
    ? t('gate.context', {
        site: context.site,
        visits: t('gate.visits', { count: context.visitsToday }),
        minutes: context.minutesToday,
      })
    : null

  if (view?.kind === 'timed_out') {
    return (
      <main class="mf-gate">
        <h1 class="mf-visually-hidden">{t('gate.title')}</h1>
        <TimeoutOverlay
          site={view.context.site}
          minutes={view.minutes}
          intention={view.intention}
          nextPauseSeconds={view.nextPauseSeconds}
          onLeave={() => void client.leave().catch(() => closeOwnTab().catch(() => undefined))}
          onExtend={() => run(() => client.extend())}
        />
      </main>
    )
  }

  const emergencyAvailable =
    view?.kind === 'friction' || (view?.kind === 'blocked' && view.emergencyAvailable)

  return (
    <main class="mf-gate">
      <h1 class="mf-visually-hidden">{t('gate.title')}</h1>
      {contextLine ? <p class="mf-gate__context">{contextLine}</p> : null}

      {view?.kind === 'friction' && view.phase === 'pausing' ? (
        <PauseBlock
          key={view.pauseEndsAtMs}
          frictionType={view.gate.frictionType}
          pauseSeconds={view.gate.pauseSeconds}
          endsAt={view.pauseEndsAtMs}
          extension={view.extension}
          clock={clock}
          onDone={() => run(() => client.pauseDone())}
        />
      ) : null}

      {view?.kind === 'blocked' ? (
        <section class="mf-gate__message">
          <h2 class="mf-gate__heading">
            {t(BLOCKED_TITLE[view.reason], { site: view.context.site })}
          </h2>
          <p class="mf-gate__why">{t(BLOCKED_WHY[view.reason])}</p>
        </section>
      ) : null}

      {view?.kind === 'none' ? (
        <section class="mf-gate__message">
          <h2 class="mf-gate__heading">{t('gate.none.title')}</h2>
          <p class="mf-gate__why">{t('gate.none.body')}</p>
        </section>
      ) : null}

      {view?.kind === 'waiting' ? (
        <section class="mf-gate__pause">
          <h2 class="mf-gate__heading">{t('gate.wait.title')}</h2>
          <Countdown
            key={view.readyAtMs}
            endsAt={view.readyAtMs}
            clock={clock}
            onDone={() => run(() => client.emergencyDone())}
          />
          <p class="mf-gate__why">{t('gate.wait.body')}</p>
          <p class="mf-gate__why">{t('gate.wait.notice')}</p>
        </section>
      ) : null}

      <Button variant="leave" autoFocus onClick={close}>
        {t('gate.close')}
      </Button>

      {view?.kind === 'blocked' && view.continueAvailable ? (
        <Button variant="secondary" onClick={() => run(() => client.continueThroughError())}>
          {t('gate.continueFeedsHidden')}
        </Button>
      ) : null}

      {view?.kind === 'waiting' ? (
        <Button variant="quiet" tone="muted" onClick={() => run(() => client.emergencyCancel())}>
          {t('gate.wait.cancel')}
        </Button>
      ) : null}

      {view?.kind === 'friction' && view.phase === 'asking' ? (
        <IntentionForm
          gate={view.gate}
          site={view.context.site}
          exampleIndex={view.exampleIndex}
          onCommit={async (minutes, intention) => {
            const result = await client.commit(minutes, intention)
            if (!result.accepted) return result.rejection
            show(result.view)
            return null
          }}
        />
      ) : null}

      {view?.kind === 'friction' ? (
        <p class="mf-gate__level">
          {[
            t('gate.level', { level: view.level.level }),
            t('gate.levelBroken', { count: view.level.brokenToday }),
            t('gate.levelNextPause', { seconds: view.level.nextPauseSeconds }),
          ].join(' · ')}
        </p>
      ) : null}

      {view?.kind === 'friction' && view.gate.level === 3 ? (
        <section class="mf-gate__guardian">
          <Button variant="secondary" disabled disabledReason={t('gate.guardianNote')}>
            {t('gate.guardianAsk')}
          </Button>
        </section>
      ) : null}

      {view?.kind === 'friction' && view.searchAvailable ? (
        <GateSearch
          site={view.context.site}
          onSearch={(query) => run(() => client.search(query))}
        />
      ) : null}

      {emergencyAvailable ? (
        <footer class="mf-gate__footer">
          <Button variant="quiet" tone="muted" onClick={() => run(() => client.emergency())}>
            {t('gate.emergency')}
          </Button>
        </footer>
      ) : null}
    </main>
  )
}

interface GateSearchProps {
  site: string
  onSearch: (query: string) => void
}

/** The site's own search (Reddit, YouTube), which the gate lets through. */
function GateSearch({ site, onSearch }: GateSearchProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const submit = () => {
    if (query.trim().length > 0) onSearch(query)
  }
  return (
    <form
      class="mf-gate__search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <TextField
        label={t('gate.searchLabel', { site })}
        value={query}
        onInput={setQuery}
        onSubmit={submit}
      />
      <Button variant="secondary" type="submit">
        {t('gate.searchSubmit')}
      </Button>
    </form>
  )
}
