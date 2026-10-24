// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'
import { Segmented, type SegmentedOption } from '../../../src/ui/Segmented'

type Minutes = '5' | '10' | '15'
const OPTIONS: SegmentedOption<Minutes>[] = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
]

function Controlled({ onChange }: { onChange?: (value: Minutes) => void }) {
  const [value, setValue] = useState<Minutes | null>(null)
  return (
    <Segmented
      label="How long?"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('Segmented', () => {
  it('segmented_is_a_radio_group_named_by_its_label', () => {
    render(<Segmented label="How long?" options={OPTIONS} value={null} onChange={vi.fn()} />)
    const group = screen.getByRole('radiogroup', { name: 'How long?' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('segmented_supports_no_default_selection', () => {
    render(<Segmented label="How long?" options={OPTIONS} value={null} onChange={vi.fn()} />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
  })

  it('selected_option_is_checked', () => {
    render(<Segmented label="How long?" options={OPTIONS} value="10" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: '10 min' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '5 min' })).not.toBeChecked()
  })

  it('choosing_an_option_reports_its_value', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: '15 min' }))

    expect(onChange).toHaveBeenCalledWith('15')
    expect(screen.getByRole('radio', { name: '15 min' })).toBeChecked()
  })

  it('arrow_keys_move_the_selection', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('radio', { name: '5 min' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: '10 min' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '10 min' })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: '5 min' })).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith('5')
  })

  it('tab_reaches_the_group_without_choosing_for_the_user', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)

    await userEvent.tab()

    expect(screen.getByRole('radio', { name: '5 min' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
  })
})
