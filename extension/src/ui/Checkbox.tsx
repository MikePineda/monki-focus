// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TargetedEvent } from 'preact'
import { useId } from 'preact/hooks'
import './FormControl.css'

export interface CheckboxProps {
  /** Already translated label. */
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** Already translated explanation under the label. */
  description?: string
}

/**
 * A native checkbox with its label (and an optional explanation linked as its
 * description). The product has no on/off switch; settings are checkboxes.
 */
export function Checkbox({ label, checked, onChange, description }: CheckboxProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  return (
    <div class="mf-checkbox">
      <input
        id={id}
        type="checkbox"
        class="mf-checkbox__input"
        checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        onChange={(event: TargetedEvent<HTMLInputElement>) => onChange(event.currentTarget.checked)}
      />
      <span class="mf-checkbox__text">
        <label class="mf-checkbox__label" for={id}>
          {label}
        </label>
        {description ? (
          <span id={descriptionId} class="mf-checkbox__description">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  )
}
