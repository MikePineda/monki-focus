// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Monotonic anchoring of a verified unlock token. On receipt the client
 * stores `(jti, iat, nbf, exp, mono_at_receipt, boot_count)`. Later the
 * token is usable only if:
 *
 *   - the boot count is unchanged (after a reboot it must be revalidated
 *     online; offline it fails closed);
 *   - `mono_now - mono_at_receipt <= (exp - iat) + 60 s`, which bounds the
 *     unlock by real elapsed time even if both clocks are wrong;
 *   - trusted now is in `[nbf - 60 s, exp + 60 s]`.
 */
import { CLOCK_SKEW_SECONDS } from './token_purpose.ts'
import type { ClaimTimes } from './claim_times.ts'
import { checkTimeWindow } from './claim_times.ts'
import type { DeviceClock } from './trusted_time.ts'
import { fail, ok, type Result } from './token_error.ts'

export interface UnlockReceipt {
  readonly jti: string
  readonly times: ClaimTimes
  readonly monoAtReceiptMs: number
  readonly bootCount: number
}

export function receiveUnlock(
  jti: string,
  times: ClaimTimes,
  clock: Pick<DeviceClock, 'monoNowMs' | 'bootCount'>
): UnlockReceipt {
  return { jti, times, monoAtReceiptMs: clock.monoNowMs, bootCount: clock.bootCount }
}

export function checkReceipt(
  receipt: UnlockReceipt,
  clock: Pick<DeviceClock, 'monoNowMs' | 'bootCount'>,
  trustedNowSeconds: number
): Result<UnlockReceipt> {
  if (clock.bootCount !== receipt.bootCount) {
    return fail('reboot_revalidation_required')
  }
  const elapsedMs = clock.monoNowMs - receipt.monoAtReceiptMs
  const budgetMs = (receipt.times.exp - receipt.times.iat + CLOCK_SKEW_SECONDS) * 1000
  if (elapsedMs < 0) {
    return fail('reboot_revalidation_required')
  }
  if (elapsedMs > budgetMs) {
    return fail('expired')
  }
  const window = checkTimeWindow(receipt.times, trustedNowSeconds)
  return window.ok ? ok(receipt) : window
}
