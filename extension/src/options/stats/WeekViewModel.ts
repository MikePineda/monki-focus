// SPDX-License-Identifier: AGPL-3.0-or-later
import type { WeekStats } from '../../shared/StatsContract'
import type { LevelIndex } from '../../ui/LevelIndex'

/**
 * The heatmap's colour for an hour's pulse: the five level bands 0–19,
 * 20–39, 40–59, 60–79 and 80–100 (DESIGN.md "Charts"); no time, no band.
 */
export function pulseBand(pulse: number | null): LevelIndex | null {
  if (pulse === null) return null
  return Math.min(4, Math.max(0, Math.floor(pulse / 20))) as LevelIndex
}

export interface DayColumn {
  date: string
  pulse: number | null
  trackedSeconds: number
  isToday: boolean
}

export interface HeatmapRow {
  /** Monday = 0 … Sunday = 6. */
  weekday: number
  /** 24 cells, hour 0 first. */
  cells: { hour: number; pulse: number | null; band: LevelIndex | null; averageSeconds: number }[]
}

export interface WeekViewModel {
  days: DayColumn[]
  heatmap: HeatmapRow[]
  /** Nothing tracked in the whole window. */
  empty: boolean
}

export function weekViewModel(week: WeekStats): WeekViewModel {
  const days = week.days.map((day, index) => ({
    date: day.date,
    pulse: day.pulse,
    trackedSeconds: day.totalSeconds,
    isToday: index === week.days.length - 1,
  }))
  const heatmap: HeatmapRow[] = Array.from({ length: 7 }, (_row, weekday) => ({
    weekday,
    cells: Array.from({ length: 24 }, (_cell, hour) => {
      const cell = week.hourly.find((entry) => entry.weekday === weekday && entry.hour === hour)
      const pulse = cell?.pulse ?? null
      return { hour, pulse, band: pulseBand(pulse), averageSeconds: cell?.averageSeconds ?? 0 }
    }),
  }))
  return { days, heatmap, empty: days.every((day) => day.trackedSeconds === 0) }
}
