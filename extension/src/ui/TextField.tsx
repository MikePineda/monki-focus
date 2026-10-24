// SPDX-License-Identifier: AGPL-3.0-or-later
import { CircleAlert, Info } from 'lucide-preact'
import type { TargetedEvent, TargetedKeyboardEvent } from 'preact'
import { useEffect, useId, useRef } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import { Icon } from './Icon'
import './TextField.css'
import { wordCount } from './wordCount'

export interface TextFieldProps {
  /** Already translated label, shown above the field. */
  label: string
  value: string
  onInput: (value: string) => void
  placeholder?: string
  /** Guidance under the field ("At least 3 words, ..."). */
  hint?: string
  /**
   * The hint's rule is not met. Shown as a neutral inline notice (`ink-1`
   * and an `info` icon), never red: a rule is guidance, not an error.
   */
  invalid?: boolean
  /** A real error (a failed save): `status-critical` with `circle-alert`. */
  error?: string
  /** Show a live word counter on the right of the helper row. */
  countWords?: boolean
  /** Called on `Enter` while the field has focus. */
  onSubmit?: () => void
  autoFocus?: boolean
}

export function TextField({
  label,
  value,
  onInput,
  placeholder,
  hint,
  invalid = false,
  error,
  countWords = false,
  onSubmit,
  autoFocus = false,
}: TextFieldProps) {
  const { t, locale } = useI18n()
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  const hintId = `${id}-hint`
  const counterId = `${id}-counter`
  const errorId = `${id}-error`

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const describedBy = [
    error ? errorId : null,
    hint ? hintId : null,
    countWords ? counterId : null,
  ].filter(Boolean)

  const handleKeyDown = (event: TargetedKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.isComposing && onSubmit) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div class="mf-text-field">
      <label class="mf-text-field__label" for={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        class="mf-text-field__input"
        type="text"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || Boolean(error) ? 'true' : undefined}
        aria-describedby={describedBy.length > 0 ? describedBy.join(' ') : undefined}
        onInput={(event: TargetedEvent<HTMLInputElement>) => onInput(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      {error ? (
        <p id={errorId} role="alert" class="mf-text-field__error">
          <Icon icon={CircleAlert} size={16} />
          <span>{error}</span>
        </p>
      ) : null}
      {hint || countWords ? (
        <div class="mf-text-field__helper">
          {hint ? (
            <p
              id={hintId}
              class={
                invalid ? 'mf-text-field__hint mf-text-field__hint--unmet' : 'mf-text-field__hint'
              }
            >
              {invalid ? <Icon icon={Info} size={16} /> : null}
              <span>{hint}</span>
            </p>
          ) : null}
          {countWords ? (
            <p id={counterId} class="mf-text-field__counter">
              {t('textField.wordCount', { count: wordCount(value, locale) })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
