// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { watchReevaluationTriggers } from '../../../src/content/ReevaluationTriggers'
import { decisionChangedMessage } from '../../../src/shared/messages'

type Listener = (message: unknown, sender: { id?: string }) => void

function makeTriggers() {
  const listeners = new Set<Listener>()
  const onMessage = {
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
  }
  const reevaluate = vi.fn()
  const stop = watchReevaluationTriggers({ window, onMessage, runtimeId: 'own', reevaluate })
  const push = (message: unknown, id = 'own') => {
    for (const listener of listeners) listener(message, { id })
  }
  return { reevaluate, stop, push, listeners }
}

function pageShow(persisted: boolean): Event {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { value: persisted })
  return event
}

describe('watchReevaluationTriggers', () => {
  it('a_decision_changed_push_from_the_service_worker_reevaluates', () => {
    const { reevaluate, push, stop } = makeTriggers()

    push(decisionChangedMessage())

    expect(reevaluate).toHaveBeenCalledOnce()
    stop()
  })

  it('pushes_from_elsewhere_or_of_another_shape_are_ignored', () => {
    const { reevaluate, push, stop } = makeTriggers()

    push(decisionChangedMessage(), 'another-extension')
    push({ v: 1, type: 'admin.wipe' })
    push('decision.changed')

    expect(reevaluate).not.toHaveBeenCalled()
    stop()
  })

  it('a_page_restored_from_the_back_forward_cache_reevaluates', () => {
    const { reevaluate, stop } = makeTriggers()

    window.dispatchEvent(pageShow(false))
    window.dispatchEvent(pageShow(true))

    expect(reevaluate).toHaveBeenCalledOnce()
    stop()
  })

  it('stop_detaches_both_triggers', () => {
    const { reevaluate, push, stop, listeners } = makeTriggers()

    stop()
    push(decisionChangedMessage())
    window.dispatchEvent(pageShow(true))

    expect(reevaluate).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })
})
