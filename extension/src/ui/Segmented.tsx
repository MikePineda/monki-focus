// SPDX-License-Identifier: AGPL-3.0-or-later
import { useId } from 'preact/hooks'
import { Icon, type LucideIcon } from './Icon'
import './Segmented.css'
import './VisuallyHidden.css'

export interface SegmentedOption<T extends string> {
  value: T
  /** Already translated option label. */
  label: string
  icon?: LucideIcon
}

export interface SegmentedProps<T extends string> {
  /** Accessible name of the group; shown above it when `labelVisible`. */
  label: string
  labelVisible?: boolean
  options: readonly SegmentedOption<T>[]
  /** `null` selects nothing: choosing is the user's commitment. */
  value: T | null
  onChange: (value: T) => void
  /** `compact`: 28px visual for the popup's chart/table toggle. */
  size?: 'default' | 'compact'
}

/**
 * Segmented control built on native radio buttons, so the browser provides
 * radio-group keyboard behaviour (Tab enters the group, arrow keys move the
 * selection) and an unselected group stays unselected until the user acts.
 */
export function Segmented<T extends string>({
  label,
  labelVisible = false,
  options,
  value,
  onChange,
  size = 'default',
}: SegmentedProps<T>) {
  const id = useId()
  const labelId = `${id}-label`
  return (
    <div class={`mf-segmented mf-segmented--${size}`}>
      <span
        id={labelId}
        class={labelVisible ? 'mf-segmented__label' : 'mf-segmented__label mf-visually-hidden'}
      >
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} class="mf-segmented__track">
        {options.map((option) => (
          <label key={option.value} class="mf-segmented__option">
            <input
              type="radio"
              class="mf-segmented__input"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span class="mf-segmented__face">
              {option.icon ? <Icon icon={option.icon} size={16} /> : null}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
