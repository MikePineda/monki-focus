// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Clock } from '../../shared/clock'
import type { CommandHandlers } from './CommandRouter'

export interface CommandDependencies {
  clock: Clock
}

/** The service worker's command table; one handler per `CommandMap` entry. */
export function createCommandHandlers({ clock }: CommandDependencies): CommandHandlers {
  return {
    'system.ping': () => ({ at: clock.now() }),
  }
}
