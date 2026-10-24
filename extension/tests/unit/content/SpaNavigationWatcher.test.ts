// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpaNavigationWatcher, YT_NAVIGATE_FINISH } from '../../../src/content/SpaNavigationWatcher'

describe('SpaNavigationWatcher', () => {
  let watcher: SpaNavigationWatcher | undefined
  const onNavigate = vi.fn<(url: string) => void>()

  function start(pollMs = 1000) {
    watcher = new SpaNavigationWatcher({ window, onNavigate, pollMs })
    watcher.start()
  }

  beforeEach(() => {
    history.replaceState(null, '', '/')
    document.head.replaceChildren()
    const title = document.createElement('title')
    title.textContent = 'Home'
    document.head.append(title)
    onNavigate.mockReset()
  })

  afterEach(() => {
    watcher?.stop()
    vi.useRealTimers()
  })

  it('popstate_to_a_new_url_reports_it', () => {
    start()
    history.pushState(null, '', '/r/examplesub/')

    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(onNavigate).toHaveBeenCalledWith(`${location.origin}/r/examplesub/`)
  })

  it('yt_navigate_finish_reports_the_new_url', () => {
    start()
    history.pushState(null, '', '/shorts/abcdefghijk')

    document.dispatchEvent(new Event(YT_NAVIGATE_FINISH))

    expect(onNavigate).toHaveBeenCalledWith(`${location.origin}/shorts/abcdefghijk`)
  })

  it('a_title_change_after_push_state_reports_the_new_url', async () => {
    start()
    history.pushState(null, '', '/explore/')

    document.title = 'Explore'

    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(`${location.origin}/explore/`)
    })
  })

  it('a_replaced_title_element_is_still_observed', async () => {
    start()
    const fresh = document.createElement('title')
    fresh.textContent = 'Fresh'
    document.head.replaceChildren(fresh)
    await Promise.resolve()
    history.pushState(null, '', '/direct/inbox/')
    onNavigate.mockReset()

    fresh.textContent = 'Inbox'

    await vi.waitFor(() => {
      expect(onNavigate).toHaveBeenCalledWith(`${location.origin}/direct/inbox/`)
    })
  })

  it('the_poll_backstop_catches_a_silent_push_state', () => {
    vi.useFakeTimers()
    start(1000)
    history.pushState(null, '', '/reels/')

    vi.advanceTimersByTime(1000)

    expect(onNavigate).toHaveBeenCalledWith(`${location.origin}/reels/`)
  })

  it('each_url_is_reported_once_whatever_signals_fire', () => {
    vi.useFakeTimers()
    start(1000)
    history.pushState(null, '', '/home')

    window.dispatchEvent(new PopStateEvent('popstate'))
    document.dispatchEvent(new Event(YT_NAVIGATE_FINISH))
    vi.advanceTimersByTime(3000)

    expect(onNavigate).toHaveBeenCalledOnce()
  })

  it('signals_without_a_url_change_report_nothing', () => {
    start()

    window.dispatchEvent(new PopStateEvent('popstate'))
    document.dispatchEvent(new Event(YT_NAVIGATE_FINISH))

    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('stop_detaches_every_signal', () => {
    vi.useFakeTimers()
    start(1000)
    watcher?.stop()
    history.pushState(null, '', '/later')

    window.dispatchEvent(new PopStateEvent('popstate'))
    document.dispatchEvent(new Event(YT_NAVIGATE_FINISH))
    vi.advanceTimersByTime(5000)

    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('never_patches_the_history_api', () => {
    const { pushState, replaceState } = history

    start()

    expect(history.pushState).toBe(pushState)
    expect(history.replaceState).toBe(replaceState)
  })
})
