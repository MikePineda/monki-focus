// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Gate } from '@monki-focus/rules/pure'
import { screen, waitFor } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { GateClient } from '../../../src/gate/GateClient'
import { GatePage } from '../../../src/gate/GatePage'
import type { GateView } from '../../../src/shared/GateContract'
import { ManualClock } from '../../support/ManualClock'
import { renderWithI18n } from '../../support/renderWithI18n'

const CONTEXT = { site: 'reddit.com', visitsToday: 3, minutesToday: 42 }

function gate(overrides: Partial<Gate> = {}): Gate {
  return {
    level: 0,
    pauseSeconds: 5,
    frictionType: 'countdown',
    requiresTypedIntention: false,
    requiresGuardianKey: false,
    ...overrides,
  }
}

function frictionView(
  clock: ManualClock,
  overrides: Partial<Extract<GateView, { kind: 'friction' }>> = {}
): GateView {
  return {
    kind: 'friction',
    context: CONTEXT,
    phase: 'pausing',
    gate: gate(),
    pauseEndsAtMs: clock.now() + 5_000,
    extension: false,
    level: { level: 0, brokenToday: 1, nextPauseSeconds: 30 },
    guardianLinked: false,
    searchAvailable: false,
    exampleIndex: 0,
    ...overrides,
  }
}

function fakeClient(view: GateView, overrides: Partial<GateClient> = {}): GateClient {
  return {
    load: vi.fn(() => Promise.resolve(view)),
    pauseDone: vi.fn(() => Promise.resolve(view)),
    commit: vi.fn(() =>
      Promise.resolve({
        accepted: true as const,
        view: { kind: 'pass' as const, url: 'https://www.reddit.com/' },
      })
    ),
    close: vi.fn(() => Promise.resolve({ closed: true })),
    emergency: vi.fn(() => Promise.resolve(view)),
    emergencyDone: vi.fn(() => Promise.resolve(view)),
    emergencyCancel: vi.fn(() => Promise.resolve(view)),
    leave: vi.fn(() => Promise.resolve({ closed: true })),
    extend: vi.fn(() => Promise.resolve(view)),
    search: vi.fn(() => Promise.resolve(view)),
    ...overrides,
  }
}

function renderGate(client: GateClient, clock: ManualClock, locale: 'en' | 'es' = 'en') {
  const navigate = vi.fn()
  renderWithI18n(
    <GatePage
      client={client}
      clock={clock}
      handoff={null}
      navigate={navigate}
      closeWindow={vi.fn()}
    />,
    locale
  )
  return { navigate }
}

describe('GatePage', () => {
  it('close_is_enabled_and_focused_from_the_first_frame', () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const client = fakeClient(frictionView(clock), { load: () => new Promise(() => undefined) })

    renderGate(client, clock)

    const close = screen.getByRole('button', { name: 'Close tab' })
    expect(close).toBeEnabled()
    expect(close).toHaveFocus()
  })

  it('the_pause_shows_the_context_the_countdown_and_its_why_line', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')

    renderGate(fakeClient(frictionView(clock)), clock)

    expect(await screen.findByText('reddit.com · 3 visits today · 42 min today')).toBeVisible()
    expect(screen.getByText('A short pause before you decide.')).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'Pause progress' })).toBeInTheDocument()
    expect(
      screen.getByText('Level 0 of 3 · 1 intention extended today · next pause: 30 s')
    ).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('the_breath_variant_shows_its_guide', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')

    renderGate(fakeClient(frictionView(clock, { gate: gate({ frictionType: 'breath' }) })), clock)

    expect(await screen.findByRole('img', { name: 'Breathing guide' })).toBeInTheDocument()
  })

  it('continue_stays_disabled_until_a_duration_is_chosen', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const client = fakeClient(frictionView(clock, { phase: 'asking' }))
    const { navigate } = renderGate(client, clock)
    const user = userEvent.setup()

    const continueButton = await screen.findByRole('button', { name: 'Continue to reddit.com' })
    expect(continueButton).toBeDisabled()
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)
    ).toBe(true)

    await user.click(screen.getByRole('radio', { name: '10 min' }))
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)

    expect(client.commit).toHaveBeenCalledWith(10, '')
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://www.reddit.com/'))
  })

  it('level_2_needs_three_words_before_continue', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const view = frictionView(clock, {
      phase: 'asking',
      gate: gate({ level: 2, requiresTypedIntention: true }),
    })
    renderGate(fakeClient(view), clock)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('radio', { name: '5 min' }))
    const continueButton = screen.getByRole('button', { name: 'Continue to reddit.com' })
    expect(continueButton).toBeDisabled()
    expect(screen.getByText('Write what you are here for first.')).toBeVisible()

    await user.type(screen.getByRole('textbox', { name: 'What are you here for?' }), 'reply to one')
    expect(continueButton).toBeEnabled()
  })

  it('a_refused_commit_shows_a_neutral_reason', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const view = frictionView(clock, {
      phase: 'asking',
      gate: gate({ level: 2, requiresTypedIntention: true }),
    })
    const client = fakeClient(view, {
      commit: vi.fn(() =>
        Promise.resolve({ accepted: false as const, rejection: 'intention.sameAsLast' as const })
      ),
    })
    renderGate(client, clock)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('radio', { name: '5 min' }))
    await user.type(screen.getByRole('textbox'), 'reply to one{Enter}')

    expect(await screen.findByText('Use different words from last time.')).toBeVisible()
  })

  it('level_3_without_a_guardian_shows_the_guardian_key_as_unavailable', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    renderGate(
      fakeClient(frictionView(clock, { gate: gate({ level: 3, pauseSeconds: 60 }) })),
      clock
    )

    expect(await screen.findByRole('button', { name: 'Ask your guardian' })).toBeDisabled()
    expect(screen.getByText('Available when a guardian is linked (phase 3).')).toBeVisible()
  })

  it('budget_block_offers_only_close_and_emergency', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const view: GateView = {
      kind: 'blocked',
      context: CONTEXT,
      reason: 'budget_exhausted',
      emergencyAvailable: true,
    }

    renderGate(fakeClient(view), clock)

    expect(await screen.findByText("Today's time for reddit.com is used up.")).toBeVisible()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Close tab',
      'Emergency',
    ])
  })

  it('emergency_shows_the_wait_with_cancel', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const waiting: GateView = {
      kind: 'waiting',
      context: CONTEXT,
      readyAtMs: clock.now() + 120_000,
    }
    const client = fakeClient(frictionView(clock), {
      emergency: vi.fn(() => Promise.resolve(waiting)),
    })
    renderGate(client, clock)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Emergency' }))

    expect(await screen.findByText('2:00')).toBeVisible()
    expect(screen.getByText('Your guardian will be told you used emergency access.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(client.emergencyCancel).toHaveBeenCalledOnce()
  })

  it('a_gate_without_destination_offers_only_close', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')

    renderGate(fakeClient({ kind: 'none' }), clock)

    expect(await screen.findByText('Nothing to continue to')).toBeVisible()
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Close tab'])
  })

  it('close_asks_the_service_worker_to_close_the_tab', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const client = fakeClient(frictionView(clock))
    renderGate(client, clock)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Close tab' }))

    expect(client.close).toHaveBeenCalledOnce()
  })

  it('the_search_box_opens_the_site_search', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')
    const client = fakeClient(frictionView(clock, { searchAvailable: true }))
    renderGate(client, clock)
    const user = userEvent.setup()

    await user.type(
      await screen.findByRole('textbox', { name: 'Search reddit.com' }),
      'bread{Enter}'
    )

    expect(client.search).toHaveBeenCalledWith('bread')
  })

  it('the_gate_speaks_spanish', async () => {
    const clock = new ManualClock('2026-01-05T09:00:00Z')

    renderGate(fakeClient(frictionView(clock, { phase: 'asking' })), clock, 'es')

    expect(await screen.findByRole('textbox', { name: '¿A qué vienes?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar pestaña' })).toBeInTheDocument()
  })
})
