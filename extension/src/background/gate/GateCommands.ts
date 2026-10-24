// SPDX-License-Identifier: AGPL-3.0-or-later
import type {
  ActiveSession,
  CommitResult,
  GateView,
  IntentionMinutes,
} from '../../shared/GateContract'
import type { ClosedAnswer, GateHandoff } from '../../shared/messages'
import type { CommandSender } from '../commands/CommandRouter'
import type { GateController } from './GateController'

/** A command that acts on a tab: the sender's own tab, never one it names. */
function tabOf(sender: CommandSender): number {
  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') throw new Error('gate.noTab')
  return tabId
}

/** Content-script commands only count from the tab's top frame. */
function topFrameTabOf(sender: CommandSender): number {
  if (sender.frameId !== 0) throw new Error('gate.notTopFrame')
  return tabOf(sender)
}

/**
 * The router's side of the gate: every command acts on the sending tab
 * (`sender.tab.id`). The router has already checked that `gate.*` comes from
 * the extension's gate page and that the page commands come from a tab
 * whose host matches the URL they name.
 */
export class GateCommands {
  constructor(private readonly controller: GateController) {}

  load(handoff: GateHandoff | null, sender: CommandSender): Promise<GateView> {
    return this.controller.load(tabOf(sender), handoff)
  }

  pauseDone(sender: CommandSender): Promise<GateView> {
    return this.controller.pauseDone(tabOf(sender))
  }

  commit(
    minutes: IntentionMinutes,
    intention: string,
    sender: CommandSender
  ): Promise<CommitResult> {
    return this.controller.commit(tabOf(sender), minutes, intention)
  }

  close(sender: CommandSender): Promise<ClosedAnswer> {
    return this.controller.close(tabOf(sender))
  }

  emergency(sender: CommandSender): Promise<GateView> {
    return this.controller.emergency(tabOf(sender))
  }

  emergencyDone(sender: CommandSender): Promise<GateView> {
    return this.controller.emergencyDone(tabOf(sender))
  }

  emergencyCancel(sender: CommandSender): Promise<GateView> {
    return this.controller.emergencyCancel(tabOf(sender))
  }

  leave(sender: CommandSender): Promise<ClosedAnswer> {
    return this.controller.leave(tabOf(sender))
  }

  extend(sender: CommandSender): Promise<GateView> {
    return this.controller.extend(tabOf(sender))
  }

  search(query: string, sender: CommandSender): Promise<GateView> {
    return this.controller.search(tabOf(sender), query)
  }

  open(url: string, sender: CommandSender): Promise<{ opened: boolean }> {
    return this.controller.open(topFrameTabOf(sender), url)
  }

  expired(url: string, sender: CommandSender): Promise<{ session: ActiveSession | null }> {
    topFrameTabOf(sender)
    return this.controller.expired(url)
  }

  leaveFromPage(url: string, sender: CommandSender): Promise<ClosedAnswer> {
    return this.controller.leaveFromPage(topFrameTabOf(sender), url)
  }

  extendFromPage(url: string, sender: CommandSender): Promise<{ opened: boolean }> {
    return this.controller.extendFromPage(topFrameTabOf(sender), url)
  }
}
