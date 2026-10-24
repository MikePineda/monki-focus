// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { X } from 'lucide-preact'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../../src/ui/Button'

describe('Button', () => {
  it('button_is_a_native_button_named_by_its_label', () => {
    render(<Button variant="ink">Start focus</Button>)
    expect(screen.getByRole('button', { name: 'Start focus' })).toBeInstanceOf(HTMLButtonElement)
  })

  it('button_never_submits_a_form_by_default', () => {
    render(<Button variant="ink">Start</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it.each(['leave', 'ink', 'secondary', 'quiet'] as const)(
    '%s_variant_is_exposed_as_a_style_hook',
    (variant) => {
      render(<Button variant={variant}>Label</Button>)
      expect(screen.getByRole('button')).toHaveClass('mf-button', `mf-button--${variant}`)
    }
  )

  it('button_activates_with_the_keyboard', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="ink" onClick={onClick}>
        Start
      </Button>
    )
    const user = userEvent.setup()

    await user.tab()
    expect(screen.getByRole('button')).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('disabled_button_says_why_and_ignores_clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="secondary" disabled disabledReason="Choose how long first" onClick={onClick}>
        Continue
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('Choose how long first')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('enabled_button_hides_its_disabled_reason', () => {
    render(
      <Button variant="secondary" disabledReason="Choose how long first">
        Continue
      </Button>
    )
    expect(screen.queryByText('Choose how long first')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).not.toHaveAccessibleDescription()
  })

  it('auto_focus_button_takes_initial_focus', () => {
    render(
      <>
        <Button variant="ink">Other</Button>
        <Button variant="leave" autoFocus>
          Close tab
        </Button>
      </>
    )
    expect(screen.getByRole('button', { name: 'Close tab' })).toHaveFocus()
  })

  it('button_icon_is_decorative', () => {
    render(
      <Button variant="leave" icon={X}>
        Close tab
      </Button>
    )
    const icon = screen.getByRole('button').querySelector('svg')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button')).toHaveAccessibleName('Close tab')
  })
})
