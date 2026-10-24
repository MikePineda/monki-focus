// SPDX-License-Identifier: AGPL-3.0-or-later
import { isDecisionChangedMessage } from '../shared/messages'

type MessageListener = (message: unknown, sender: { id?: string | undefined }) => void

/** The slice of `runtime.onMessage` the triggers listen on. */
export interface RuntimeMessageEvent {
  addListener(listener: MessageListener): void
  removeListener(listener: MessageListener): void
}

export interface ReevaluationTriggersOptions {
  window: Window
  onMessage: RuntimeMessageEvent
  /** This extension's id; pushes from anywhere else are ignored. */
  runtimeId: string
  reevaluate: () => void
}

/**
 * Same URL, possibly a different answer: the guard asks again when the
 * service worker pushes `decision.changed` (rule set edited, a schedule
 * edge passed) and when the page comes back from the back/forward cache
 * (`pageshow` with `persisted`), where no content script starts again.
 * Returns the function that detaches both.
 */
export function watchReevaluationTriggers({
  window,
  onMessage,
  runtimeId,
  reevaluate,
}: ReevaluationTriggersOptions): () => void {
  const onPush: MessageListener = (message, sender) => {
    if (sender.id === runtimeId && isDecisionChangedMessage(message)) reevaluate()
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) reevaluate()
  }
  onMessage.addListener(onPush)
  window.addEventListener('pageshow', onPageShow)
  return () => {
    onMessage.removeListener(onPush)
    window.removeEventListener('pageshow', onPageShow)
  }
}
