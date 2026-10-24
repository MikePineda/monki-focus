// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLACEHOLDER_TAG, PlaceholderMount } from '../../../src/content/PlaceholderMount'
import { reddit } from '../../../src/sites/reddit'

function makeMount() {
  const unmount = vi.fn()
  const render = vi.fn((container: HTMLElement) => {
    container.textContent = 'placeholder'
    return unmount
  })
  const mount = new PlaceholderMount({ document, site: reddit, css: '.x{}', render })
  return { mount, render, unmount }
}

describe('PlaceholderMount', () => {
  let mount: PlaceholderMount | undefined

  beforeEach(() => {
    document.body.replaceChildren()
  })

  afterEach(() => {
    mount?.destroy()
    vi.useRealTimers()
  })

  it('mounts_in_a_shadow_root_right_before_the_hidden_feed', () => {
    const app = document.createElement('shreddit-app')
    const feed = document.createElement('shreddit-feed')
    app.append(feed)
    document.body.append(app)
    const made = makeMount()
    mount = made.mount

    mount.show('reddit.feed')

    const host = feed.previousElementSibling as HTMLElement
    expect(host.tagName.toLowerCase()).toBe(PLACEHOLDER_TAG)
    expect(host.shadowRoot?.querySelector('style')?.textContent).toBe('.x{}')
    expect(host.shadowRoot?.textContent).toContain('placeholder')
    expect(made.render).toHaveBeenCalledOnce()
  })

  it('waits_for_a_feed_container_that_arrives_late', async () => {
    vi.useFakeTimers()
    mount = makeMount().mount
    mount.show('reddit.feed')
    expect(document.querySelector(PLACEHOLDER_TAG)).toBeNull()

    const feed = document.createElement('shreddit-feed')
    document.body.append(feed)
    await vi.advanceTimersByTimeAsync(100)

    expect(feed.previousElementSibling?.tagName.toLowerCase()).toBe(PLACEHOLDER_TAG)
  })

  it('removes_the_placeholder_when_the_feed_is_shown_again', () => {
    document.body.append(document.createElement('shreddit-feed'))
    const made = makeMount()
    mount = made.mount
    mount.show('reddit.feed')

    mount.show(null)

    expect(document.querySelector(PLACEHOLDER_TAG)).toBeNull()
    expect(made.unmount).toHaveBeenCalledOnce()
  })

  it('removes_the_placeholder_when_the_feed_container_goes_away', async () => {
    vi.useFakeTimers()
    const feed = document.createElement('shreddit-feed')
    document.body.append(feed)
    mount = makeMount().mount
    mount.show('reddit.feed')

    feed.remove()
    await vi.advanceTimersByTimeAsync(100)

    expect(document.querySelector(PLACEHOLDER_TAG)).toBeNull()
  })

  it('a_surface_without_selectors_mounts_nothing', () => {
    document.body.append(document.createElement('shreddit-feed'))
    mount = makeMount().mount

    mount.show('reddit.permalink')

    expect(document.querySelector(PLACEHOLDER_TAG)).toBeNull()
  })
})
