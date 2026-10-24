// SPDX-License-Identifier: AGPL-3.0-or-later
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applySessionEvent,
  initialSession,
  type SessionEvent,
  type SessionOutcome,
} from '../src/unlock_session.ts'
import { loadJson, packageRoot } from './token_vector_loader.ts'

interface StateMachineVector {
  id: string
  kind: 'unlock-state-machine'
  description: string
  events: (SessionEvent & { outcome: SessionOutcome })[]
}

const vectors = readdirSync(join(packageRoot, 'fixtures/state-machines'))
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => loadJson(`fixtures/state-machines/${name}`) as StateMachineVector)

describe('shared state-machine vectors', () => {
  it('test_state_machine_vectors_cover_the_review_scenarios', () => {
    expect(vectors.map((vector) => vector.id)).toEqual(
      expect.arrayContaining([
        'service_worker_restart_and_clock_rewind_do_not_extend_an_active_unlock',
        'reboot_clock_jump_purge_and_rewind_cannot_replay',
        'authoritative_time_token_lowers_a_bad_floor',
        'revocations_incomplete_persists_until_a_complete_time_token',
        'activation_is_usable_until_exactly_dur_s_of_monotonic_time',
      ])
    )
  })

  it.each(vectors.map((vector) => [vector.id, vector] as const))('test_%s', (_id, vector) => {
    let state = initialSession()
    vector.events.forEach(({ outcome: _expected, ...event }, index) => {
      const applied = applySessionEvent(state, event)
      state = applied.state
      expect({ event: index, ...applied.outcome }).toEqual({ event: index, ..._expected })
    })
  })
})
