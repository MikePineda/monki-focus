// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CommitResult, GateView, IntentionMinutes } from '../shared/GateContract'
import {
  commandMessage,
  type ClosedAnswer,
  type CommandMessage,
  type CommandRequest,
  type CommandResponse,
  type CommandResult,
  type CommandType,
  type GateHandoff,
} from '../shared/messages'

/** What the gate page asks the service worker; every answer is the engine's state as a view. */
export interface GateClient {
  load(handoff: GateHandoff | null): Promise<GateView>
  pauseDone(): Promise<GateView>
  commit(minutes: IntentionMinutes, intention: string): Promise<CommitResult>
  close(): Promise<ClosedAnswer>
  emergency(): Promise<GateView>
  emergencyDone(): Promise<GateView>
  emergencyCancel(): Promise<GateView>
  leave(): Promise<ClosedAnswer>
  extend(): Promise<GateView>
  search(query: string): Promise<GateView>
  continueThroughError(): Promise<GateView>
}

export type SendCommand = (message: CommandMessage) => Promise<unknown>

/** The gate page's commands over `runtime.sendMessage`; an error answer rejects. */
export function gateClient(send: SendCommand): GateClient {
  const call = async <T extends CommandType>(
    type: T,
    payload: CommandRequest<T>
  ): Promise<CommandResponse<T>> => {
    const result = (await send(commandMessage(type, payload) as CommandMessage)) as
      CommandResult<T> | undefined
    if (!result || result.ok !== true)
      throw new Error(result?.ok === false ? result.error : 'gate.noAnswer')
    return result.data
  }
  return {
    load: (handoff) => call('gate.load', { handoff }),
    pauseDone: () => call('gate.pauseDone', {}),
    commit: (minutes, intention) => call('gate.commit', { minutes, intention }),
    close: () => call('gate.close', {}),
    emergency: () => call('gate.emergency', {}),
    emergencyDone: () => call('gate.emergencyDone', {}),
    emergencyCancel: () => call('gate.emergencyCancel', {}),
    leave: () => call('gate.leave', {}),
    extend: () => call('gate.extend', {}),
    search: (query) => call('gate.search', { query }),
    continueThroughError: () => call('gate.continue', {}),
  }
}
