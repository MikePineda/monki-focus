// SPDX-License-Identifier: AGPL-3.0-or-later
import './ProgressLine.css'

export interface ProgressLineProps {
  /** Already translated accessible name ("Pause progress"). */
  label: string
  value: number
  max: number
}

/**
 * 1px linear progress (no rings, never the accent). The caller derives
 * `value` from a stored end time; the line only draws it. The fill moves
 * by `transform`, with a linear transition only when motion is welcome.
 */
export function ProgressLine({ label, value, max }: ProgressLineProps) {
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0))
  const fraction = max > 0 ? clamped / max : 0
  return (
    <div
      class="mf-progress-line"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
    >
      <div class="mf-progress-line__fill" style={{ transform: `scaleX(${fraction})` }} />
    </div>
  )
}
