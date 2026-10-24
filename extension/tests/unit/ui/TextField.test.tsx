// SPDX-License-Identifier: AGPL-3.0-or-later
import { screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'
import { TextField, type TextFieldProps } from '../../../src/ui/TextField'
import { renderWithI18n } from '../../support/renderWithI18n'

type Props = Omit<TextFieldProps, 'value' | 'onInput'> & { initial?: string }

function Controlled({ initial = '', ...props }: Props) {
  const [value, setValue] = useState(initial)
  return <TextField {...props} value={value} onInput={setValue} />
}

describe('TextField', () => {
  it('text_field_is_labelled_by_its_visible_label', () => {
    renderWithI18n(<Controlled label="What are you here for?" />)
    expect(screen.getByRole('textbox', { name: 'What are you here for?' })).toBeInTheDocument()
  })

  it('word_counter_counts_words_as_the_user_types', async () => {
    renderWithI18n(<Controlled label="Intention" countWords />)
    expect(screen.getByText('0 words')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), 'Reply')
    expect(screen.getByText('1 word')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox'), ' to one message')
    expect(screen.getByText('4 words')).toBeInTheDocument()
  })

  it('word_counter_is_translated', () => {
    renderWithI18n(<Controlled label="Intención" countWords initial="Revisar el horario" />, 'es')
    expect(screen.getByText('3 palabras')).toBeInTheDocument()
  })

  it('field_is_described_by_its_hint_and_counter', () => {
    renderWithI18n(
      <Controlled
        label="Intention"
        hint="At least 3 words, different from last time."
        countWords
        initial="Reply now"
      />
    )
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      'At least 3 words, different from last time. 2 words'
    )
  })

  it('unmet_requirement_is_a_neutral_inline_notice_not_an_alarm', () => {
    renderWithI18n(
      <Controlled label="Intention" hint="At least 3 words, different from last time." invalid />
    )
    const field = screen.getByRole('textbox')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const hint = screen.getByText('At least 3 words, different from last time.')
    expect(hint.closest('.mf-text-field__hint')).toHaveClass('mf-text-field__hint--unmet')
    expect(hint.closest('.mf-text-field__hint')?.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
  })

  it('real_error_is_announced_as_an_alert', () => {
    renderWithI18n(<Controlled label="Intention" error="Could not save. Try again." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save. Try again.')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('enter_submits_only_while_the_field_has_focus', async () => {
    const onSubmit = vi.fn()
    renderWithI18n(
      <>
        <Controlled label="Intention" onSubmit={onSubmit} />
        <button type="button">Elsewhere</button>
      </>
    )
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }))
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('textbox'))
    await user.keyboard('Check the hours{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
