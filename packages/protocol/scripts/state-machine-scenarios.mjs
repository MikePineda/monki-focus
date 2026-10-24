// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Hand-written inputs of the state-machine vectors. Each event lists the key
 * facts a reviewer expects (`expect`, a subset of the outcome);
 * `gen-vectors.mjs` runs the reference driver, fails if any expectation does
 * not hold, and writes the FULL outcome of every event to
 * `fixtures/state-machines/<id>.json`, which runners compare field by field.
 */
const J1 = '3b0e5f1a-7c2d-4e8f-9a6b-1c2d3e4f5a6b'
const J2 = '8e7d6c5b-4a39-4281-9f0e-1d2c3b4a5f6e'
const SW_A = '0f8e7d6c-5b4a-4938-8271-605f4e3d2c1b'
const SW_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

const t = (hms, day = '2026-01-05') => `${day}T${hms}Z`
const receive = (jti = J1, overrides = {}) => ({
  type: 'unlock_received',
  jti,
  iat: t('09:00:00'),
  nbf: t('09:00:00'),
  exp: t('09:30:00'),
  durS: 900,
  ...overrides,
})
const anchor = (srv, sentMono, extra = {}) => ({ type: 'time_response', srv, sentMono, ...extra })
const act = (type, jti = J1) => ({ type, jti })
const ev = (wall, mono, boot, action, expect = {}) => ({ wall, mono, boot, action, expect })

export const SCENARIOS = [
  {
    id: 'service_worker_restart_and_clock_rewind_do_not_extend_an_active_unlock',
    description:
      'Extension: the unlock is active, the service worker restarts (new in-memory boot id) and the wall clock is set back. Without a current-boot anchor nothing is usable; after a fresh anchor the activation from the old boot needs revalidation, and revalidation finds it already over (the entry moves to ended while the call returns an error).',
    events: [
      ev(t('09:00:00'), 1000, SW_A, anchor(t('09:00:00'), 1000), {
        ok: true,
        trustedNow: t('09:00:00'),
      }),
      ev(t('09:00:05'), 6000, SW_A, receive(), { ok: true, status: 'received' }),
      ev(t('09:00:05'), 6000, SW_A, act('activate'), {
        ok: true,
        end: t('09:15:05'),
        status: 'active',
      }),
      ev(t('08:10:00'), 500, SW_B, act('activate'), {
        ok: false,
        error: 'time_anchor_required',
        status: 'active',
        trustedNow: t('09:00:05'),
      }),
      ev(t('08:10:01'), 1500, SW_B, anchor(t('10:00:00'), 1000), {
        ok: true,
        trustedNow: t('10:00:00'),
      }),
      ev(t('08:10:01'), 2000, SW_B, act('activate'), {
        ok: false,
        error: 'revalidation_required',
        status: 'active',
      }),
      ev(t('08:10:01'), 2000, SW_B, act('revalidate'), {
        ok: false,
        error: 'expired',
        status: 'ended',
      }),
      ev(t('08:10:01'), 2000, SW_B, act('activate'), {
        ok: false,
        error: 'replayed',
        status: 'ended',
      }),
    ],
  },
  {
    id: 'reboot_clock_jump_purge_and_rewind_cannot_replay',
    description:
      'Android: an ended unlock, a reboot, the wall clock jumped three days ahead, a purge on wall-only time (a no-op), the clock set back and the same token offered again: refused. With a real anchor the purge runs and the token is still refused as expired.',
    events: [
      ev(t('09:00:00'), 10000, '41', anchor(t('09:00:00'), 10000), { ok: true }),
      ev(t('09:00:00'), 10000, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 10000, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(t('09:01:00'), 70000, '41', act('deactivate'), { ok: true, status: 'ended' }),
      ev(t('09:00:00', '2026-01-08'), 5000, '42', { type: 'purge' }, { ok: true, entries: [J1] }),
      ev(t('09:02:00'), 6000, '42', receive(), { ok: false, error: 'replayed', status: 'ended' }),
      ev(t('09:02:01'), 7000, '42', anchor(t('09:00:00', '2026-01-08'), 6500), { ok: true }),
      ev(t('09:02:02'), 8000, '42', { type: 'purge' }, { ok: true, entries: [] }),
      ev(t('09:02:02'), 8000, '42', receive(), { ok: false, error: 'expired', status: 'absent' }),
    ],
  },
  {
    id: 'wall_clock_rewind_within_a_boot_does_not_extend_an_unlock',
    description:
      'The monotonic clock bounds an activation; re-activation returns the original end.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 0, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(t('08:30:00'), 600000, '41', act('activate'), {
        ok: true,
        end: t('09:15:00'),
        trustedNow: t('09:10:00'),
      }),
      ev(t('08:31:00'), 900001, '41', act('activate'), {
        ok: false,
        error: 'expired',
        status: 'ended',
      }),
      ev(t('08:31:00'), 900001, '41', act('activate'), { ok: false, error: 'replayed' }),
    ],
  },
  {
    id: 'activation_is_usable_until_exactly_dur_s_of_monotonic_time',
    description:
      'An authoritative time token moves trusted time back 5 minutes, so the trusted end is not reached; the monotonic budget alone decides: usable at elapsed == dur_s, ended 1 ms later.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 0, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(t('08:00:00'), 600000, '41', anchor(t('09:05:00'), 600000), {
        ok: true,
        notices: ['time_floor_lowered'],
        floor: t('09:05:00'),
      }),
      ev(t('08:00:00'), 900000, '41', act('activate'), {
        ok: true,
        end: t('09:15:00'),
        trustedNow: t('09:10:00'),
      }),
      ev(t('08:00:00'), 900001, '41', act('activate'), {
        ok: false,
        error: 'expired',
        status: 'ended',
      }),
    ],
  },
  {
    id: 'unlock_end_is_capped_at_exp_plus_skew',
    description: 'end = min(activated_at + dur_s, exp + 60 s).',
    events: [
      ev(t('09:24:00'), 0, '41', anchor(t('09:24:00'), 0), { ok: true }),
      ev(t('09:24:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:24:00'), 0, '41', act('activate'), { ok: true, end: t('09:31:00') }),
      ev(t('09:31:00'), 420000, '41', act('activate'), {
        ok: false,
        error: 'expired',
        status: 'ended',
      }),
    ],
  },
  {
    id: 'receipt_and_activation_need_a_current_boot_anchor',
    description:
      'No first receipt or activation on wall-only time; after a reboot the receipt needs revalidation before activation.',
    events: [
      ev(t('09:00:00'), 0, '41', receive(), {
        ok: false,
        error: 'time_anchor_required',
        status: 'absent',
      }),
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true, status: 'received' }),
      ev(t('09:01:00'), 100, '42', act('activate'), { ok: false, error: 'time_anchor_required' }),
      ev(t('09:01:00'), 200, '42', anchor(t('09:01:00'), 100), { ok: true }),
      ev(t('09:01:00'), 200, '42', act('activate'), { ok: false, error: 'revalidation_required' }),
      ev(t('09:01:00'), 200, '42', act('revalidate'), { ok: true, status: 'received' }),
      ev(t('09:01:00'), 200, '42', act('activate'), {
        ok: true,
        end: t('09:16:00'),
        status: 'active',
      }),
    ],
  },
  {
    id: 'stale_time_response_is_refused',
    description:
      'A time answer is accepted only within 60 s of sending its request, and never with the monotonic clock behind the send.',
    events: [
      ev(t('09:00:00'), 70000, '41', anchor(t('09:00:00'), 9000), {
        ok: false,
        error: 'stale_time',
      }),
      ev(t('09:00:00'), 70000, '41', anchor(t('09:00:00'), 10000), {
        ok: true,
        trustedNow: t('09:01:00'),
      }),
      ev(t('09:00:00'), 70000, '41', anchor(t('09:00:00'), 80000), {
        ok: false,
        error: 'stale_time',
      }),
    ],
  },
  {
    id: 'trusted_floor_survives_reboot_and_ignores_the_wall_clock',
    description:
      'The floor ratchets from anchored time only, persists across boots and is never raised by a wall clock set ahead.',
    events: [
      ev(t('09:00:00'), 0, SW_A, anchor(t('09:00:00'), 0), { ok: true }),
      ev(
        t('09:00:00'),
        600000,
        SW_A,
        { type: 'observe' },
        { trustedNow: t('09:10:00'), floor: t('09:10:00') }
      ),
      ev(t('08:00:00'), 10, SW_B, { type: 'observe' }, { trustedNow: t('09:10:00') }),
      ev(
        t('09:30:00'),
        20,
        SW_B,
        { type: 'observe' },
        { trustedNow: t('09:30:00'), floor: t('09:10:00') }
      ),
      ev(t('08:00:00'), 30, SW_B, { type: 'observe' }, { trustedNow: t('09:10:00') }),
    ],
  },
  {
    id: 'authoritative_time_token_lowers_a_bad_floor',
    description:
      'A floor pushed into the future (here by a token iat, capped at anchored + 4 h) is reset by the next verified time token, with a time_floor_lowered notice; without a current-boot anchor iat never raises the floor.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true, floor: t('09:00:00') }),
      ev(
        t('09:00:00'),
        0,
        '41',
        receive(J2, { iat: t('15:00:00'), nbf: t('15:00:00'), exp: t('15:30:00') }),
        { ok: false, error: 'not_yet_valid', floor: t('13:00:00'), trustedNow: t('13:00:00') }
      ),
      ev(t('09:00:30'), 30000, '41', anchor(t('09:00:30'), 30000), {
        ok: true,
        notices: ['time_floor_lowered'],
        floor: t('09:00:30'),
        trustedNow: t('09:00:30'),
      }),
      ev(
        t('09:01:00'),
        100,
        '42',
        receive(J1, { iat: t('11:00:00'), nbf: t('11:00:00'), exp: t('11:30:00') }),
        {
          ok: false,
          error: 'time_anchor_required',
          floor: t('09:00:30'),
        }
      ),
      ev(t('09:01:00'), 200, '42', anchor(t('09:00:59'), 200), { ok: true, notices: [] }),
    ],
  },
  {
    id: 'revocations_incomplete_persists_until_a_complete_time_token',
    description:
      'complete false sets a persisted flag: existing and new receipts need revalidation until a complete time token clears it; revalidated entries are usable.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0, { revoked: [], complete: false }), {
        ok: true,
        revocationsIncomplete: true,
      }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true, status: 'received' }),
      ev(t('09:00:00'), 0, '41', act('activate'), { ok: false, error: 'revalidation_required' }),
      ev(
        t('09:00:10'),
        10000,
        '41',
        anchor(t('09:00:10'), 10000, { revoked: [], complete: true }),
        {
          ok: true,
          revocationsIncomplete: false,
        }
      ),
      ev(t('09:00:10'), 10000, '41', receive(J2), { ok: true, status: 'received' }),
      ev(t('09:00:10'), 10000, '41', act('activate', J2), { ok: true, end: t('09:15:10') }),
      ev(t('09:00:10'), 10000, '41', act('activate'), {
        ok: false,
        error: 'revalidation_required',
      }),
      ev(t('09:00:10'), 10000, '41', act('revalidate'), { ok: true, status: 'received' }),
      ev(t('09:00:10'), 10000, '41', act('activate'), { ok: true, end: t('09:15:10') }),
    ],
  },
  {
    id: 'revocation_before_delivery_refuses_the_token',
    description: 'A signed revocation list may name a jti the device has not received yet.',
    events: [
      ev(
        t('09:00:00'),
        0,
        '41',
        anchor(t('09:00:00'), 0, { revoked: [{ jti: J1, exp: t('09:30:00') }], complete: true }),
        { ok: true, entries: [J1] }
      ),
      ev(t('09:00:00'), 0, '41', receive(), { ok: false, error: 'revoked', status: 'revoked' }),
    ],
  },
  {
    id: 'revoked_active_unlock_ends',
    description: 'A revocation in a later time token stops an active unlock.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 0, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(
        t('09:01:00'),
        60000,
        '41',
        anchor(t('09:01:00'), 60000, {
          revoked: [{ jti: J1, exp: t('09:30:00') }],
          complete: true,
        }),
        { ok: true }
      ),
      ev(t('09:01:00'), 60000, '41', act('activate'), {
        ok: false,
        error: 'revoked',
        status: 'revoked',
      }),
    ],
  },
  {
    id: 'incomplete_revocation_list_requires_revalidation',
    description:
      'complete false: every received or active unlock needs online revalidation; the original end never moves.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 0, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(
        t('09:01:00'),
        60000,
        '41',
        anchor(t('09:01:00'), 60000, { revoked: [], complete: false }),
        { ok: true }
      ),
      ev(t('09:01:00'), 60000, '41', act('activate'), {
        ok: false,
        error: 'revalidation_required',
        status: 'active',
      }),
      ev(t('09:01:00'), 60000, '41', act('revalidate'), { ok: true, status: 'active' }),
      ev(t('09:01:00'), 60000, '41', act('activate'), { ok: true, end: t('09:15:00') }),
      ev(t('09:01:00'), 900001, '41', act('activate'), {
        ok: false,
        error: 'expired',
        status: 'ended',
      }),
    ],
  },
  {
    id: 'purge_keeps_entries_until_a_day_after_exp',
    description:
      'Purge runs only with a current-boot anchor and drops an entry once trusted now passes exp + 1 day.',
    events: [
      ev(t('09:00:00'), 0, '41', anchor(t('09:00:00'), 0), { ok: true }),
      ev(t('09:00:00'), 0, '41', receive(), { ok: true }),
      ev(t('09:00:00'), 0, '41', act('deactivate'), { ok: true, status: 'ended' }),
      ev(
        t('09:00:00'),
        88200000,
        '41',
        { type: 'purge' },
        { entries: [J1], trustedNow: t('09:30:00', '2026-01-06') }
      ),
      ev(
        t('09:00:00'),
        88201000,
        '41',
        { type: 'purge' },
        { entries: [], trustedNow: t('09:30:01', '2026-01-06') }
      ),
    ],
  },
]
