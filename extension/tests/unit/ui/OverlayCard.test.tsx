// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Button } from '../../../src/ui/Button'
import { OverlayCard } from '../../../src/ui/OverlayCard'

function Timeout({ preview = false }: { preview?: boolean }) {
  return (
    <>
      <button type="button">Page behind</button>
      <OverlayCard
        context="news.example · 10 min"
        title="Your 10 min for “Check the hours” are up."
        note="Counts as a broken intention · next pause will be 30 s"
        preview={preview}
      >
        <Button variant="leave">Leave news.example</Button>
        <Button variant="secondary">5 more min</Button>
      </OverlayCard>
    </>
  )
}

describe('OverlayCard', () => {
  it('overlay_card_is_a_modal_dialog_named_by_its_title', () => {
    render(<Timeout />)
    const dialog = screen.getByRole('dialog', { name: 'Your 10 min for “Check the hours” are up.' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(
      'Counts as a broken intention · next pause will be 30 s'
    )
  })

  it('first_action_takes_initial_focus', () => {
    render(<Timeout />)
    expect(screen.getByRole('button', { name: 'Leave news.example' })).toHaveFocus()
  })

  it('focus_is_trapped_inside_the_card', async () => {
    render(<Timeout />)
    const user = userEvent.setup()
    const leave = screen.getByRole('button', { name: 'Leave news.example' })
    const more = screen.getByRole('button', { name: '5 more min' })

    await user.tab()
    expect(more).toHaveFocus()
    await user.tab()
    expect(leave).toHaveFocus()
    await user.tab({ shift: true })
    expect(more).toHaveFocus()
  })

  it('escape_does_not_dismiss_the_card', async () => {
    render(<Timeout />)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave news.example' })).toHaveFocus()
  })

  it('preview_card_neither_traps_nor_steals_focus', () => {
    render(<Timeout preview />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveAttribute('aria-modal')
    expect(screen.getByRole('button', { name: 'Leave news.example' })).not.toHaveFocus()
  })
})
