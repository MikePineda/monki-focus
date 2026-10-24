// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from '../../../src/ui/Banner'
import { renderWithI18n } from '../../support/renderWithI18n'

const NOTICE = 'Your guardian will be told you used emergency access.'

describe('Banner', () => {
  it('notice_banner_states_its_kind_in_words_next_to_its_icon', () => {
    const { container } = renderWithI18n(<Banner message={NOTICE} />)
    const banner = container.querySelector('.mf-banner')
    expect(banner).toHaveClass('mf-banner--notice')
    expect(banner).toHaveTextContent(`Notice${NOTICE}`)
    expect(banner?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('notice_banner_is_never_an_alarm', () => {
    renderWithI18n(<Banner message={NOTICE} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warning_and_error_banners_name_their_kind', () => {
    const { container, rerender } = renderWithI18n(<Banner tone="warning" message="Setup" />)
    expect(container.querySelector('.mf-banner')).toHaveTextContent('WarningSetup')
    rerender(<Banner tone="error" message="Broken" />)
    expect(container.querySelector('.mf-banner')).toHaveTextContent('ErrorBroken')
  })

  it('banner_offers_one_quiet_action', async () => {
    const onClick = vi.fn()
    renderWithI18n(
      <Banner
        tone="warning"
        message="Not running in private windows."
        action={{ label: 'Allow', onClick }}
      />
    )
    const action = screen.getByRole('button', { name: 'Allow' })
    expect(action).toHaveClass('mf-button--quiet')
    await userEvent.click(action)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('banner_kind_is_translated', () => {
    const { container } = renderWithI18n(<Banner message="Aviso de prueba" />, 'es')
    expect(container.querySelector('.mf-banner')).toHaveTextContent('AvisoAviso de prueba')
  })
})
