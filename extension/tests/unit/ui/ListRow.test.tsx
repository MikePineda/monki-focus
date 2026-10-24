// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { Globe } from 'lucide-preact'
import { describe, expect, it, vi } from 'vitest'
import { ListRow } from '../../../src/ui/ListRow'

describe('ListRow', () => {
  it('list_row_is_a_list_item_with_primary_secondary_and_trailing_value', () => {
    render(
      <ul>
        <ListRow primary="news.example" secondary="3 visits today" trailing="42 min" />
      </ul>
    )
    const row = screen.getByRole('listitem')
    expect(row).toHaveTextContent('news.example3 visits today42 min')
    expect(screen.getByText('42 min')).toHaveClass('mf-list-row__trailing')
  })

  it('interactive_list_row_is_a_button_with_a_disclosure_chevron', async () => {
    const onClick = vi.fn()
    render(
      <ul>
        <ListRow primary="Statistics" leading={{ icon: Globe }} onClick={onClick} />
      </ul>
    )
    const button = screen.getByRole('button', { name: 'Statistics' })
    expect(button.querySelectorAll('svg')).toHaveLength(2)
    for (const icon of button.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('link_list_row_is_a_link', () => {
    render(
      <ul>
        <ListRow primary="Settings" href="options.html" />
      </ul>
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', 'options.html')
  })

  it('static_list_row_is_not_focusable', () => {
    render(
      <ul>
        <ListRow primary="news.example" trailing="42 min" leading={{ level: 0 }} />
      </ul>
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem').querySelector('.mf-level-dot')).toHaveAttribute(
      'data-level',
      '0'
    )
  })
})
