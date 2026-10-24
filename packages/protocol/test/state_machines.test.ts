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
  events: (SessionEvent & { expect: Partial<SessionOutcome> })[]
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
      ])
    )
  })

  it.each(vectors.map((vector) => [vector.id, vector] as const))('test_%s', (_id, vector) => {
    let state = initialSession()
    vector.events.forEach((event, index) => {
      const applied = applySessionEvent(state, event)
      state = applied.state
      expect({ event: index, ...applied.outcome }).toMatchObject({ event: index, ...event.expect })
    })
  })
})
