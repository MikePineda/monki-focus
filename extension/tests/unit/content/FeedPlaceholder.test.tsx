// SPDX-License-Identifier: AGPL-3.0-or-later
import { fireEvent, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FeedPlaceholder } from '../../../src/content/FeedPlaceholder'
import { instagram } from '../../../src/sites/instagram'
import { reddit } from '../../../src/sites/reddit'
import { x } from '../../../src/sites/x'
import { youtube } from '../../../src/sites/youtube'
import { renderWithI18n } from '../../support/renderWithI18n'

function renderPlaceholder(site = reddit, locale: 'en' | 'es' = 'en') {
  const navigate = vi.fn<(path: string) => void>()
  const activateTab = vi.fn<(selector: string) => void>()
  renderWithI18n(
    <FeedPlaceholder site={site} navigate={navigate} activateTab={activateTab} />,
    locale
  )
  return { navigate, activateTab }
}

describe('FeedPlaceholder', () => {
  it('says_the_feed_is_hidden_in_english', () => {
    renderPlaceholder(reddit, 'en')

    expect(screen.getByRole('heading', { name: 'Feed hidden' })).toBeInTheDocument()
    expect(screen.getByText(/remove the Reddit feed/)).toBeInTheDocument()
  })

  it('says_the_feed_is_hidden_in_spanish', () => {
    renderPlaceholder(reddit, 'es')

    expect(screen.getByRole('heading', { name: 'Feed oculto' })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar en Reddit')).toBeInTheDocument()
    expect(screen.getByText('Tus comunidades')).toBeInTheDocument()
  })

  it('reddit_offers_search_and_the_allowed_communities', async () => {
    const { navigate } = renderPlaceholder(reddit)

    await userEvent.type(screen.getByLabelText('Search Reddit'), 'sourdough tips{Enter}')

    expect(navigate).toHaveBeenCalledWith('/search/?q=sourdough+tips')
    expect(screen.getByText('Communities you allow will show up here.')).toBeInTheDocument()
  })

  it('an_empty_search_goes_nowhere', () => {
    const { navigate } = renderPlaceholder(reddit)

    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(navigate).not.toHaveBeenCalled()
  })

  it('x_offers_following_and_search', () => {
    const { activateTab, navigate } = renderPlaceholder(x)

    fireEvent.click(screen.getByRole('button', { name: 'Following' }))
    fireEvent.input(screen.getByLabelText('Search X'), { target: { value: 'news' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(activateTab).toHaveBeenCalledWith(expect.stringContaining(':nth-child(2)'))
    expect(navigate).toHaveBeenCalledWith('/search?q=news')
  })

  it('youtube_offers_search_and_subscriptions', () => {
    renderPlaceholder(youtube)

    expect(screen.getByLabelText('Search YouTube')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute(
      'href',
      '/feed/subscriptions'
    )
  })

  it('instagram_offers_direct_and_search_in_spanish', () => {
    renderPlaceholder(instagram, 'es')

    expect(screen.getByRole('link', { name: 'Mensajes' })).toHaveAttribute('href', '/direct/inbox/')
    expect(screen.getByRole('link', { name: 'Buscar' })).toHaveAttribute('href', '/explore/search/')
  })
})
