// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import limiter from '@adonisjs/limiter/services/main'
import { starterPreset } from '@monki-focus/rules/pure'
import Clock from '#services/clock'
import Device from '#models/device'
import User from '#models/user'
import { freezeTime } from '#tests/support/fixed_clock'
import { enrolledDevice } from '#tests/factories/device_factory'
import { UserFactory } from '#tests/factories/user_factory'
import { guardianPair } from '#tests/factories/guardian_link_factory'
import { bootKeys, contractValidator, heartbeatBody } from '#tests/support/device_api'
import { RULE_SETS_TABLE } from '#services/rules/rule_set_store'
import { DEVICE_HEARTBEATS_TABLE } from '#services/devices/heartbeat_service'
import { ruleSetContentHash } from '#domain/rules/rule_set_content_hash'
import AccountDeletion from '#services/accounts/account_deletion'

/** A valid synthetic rule set (the bundled starter preset) with an extra synthetic rule. */
function aRuleSet(revision = 1) {
  const ruleSet = structuredClone(starterPreset) as unknown as Record<string, unknown> & {
    rules: Array<Record<string, unknown>>
  }
  ruleSet.revision = revision
  ruleSet.rules = [
    ...ruleSet.rules,
    {
      id: 'synthetic-block',
      target: { kind: 'site', domain: 'example.com' },
      mode: 'block',
      schedules: [],
      enabled: true,
    },
  ]
  return ruleSet
}

async function storedRows(userId: number) {
  const rows = await db.from(RULE_SETS_TABLE).where('user_id', userId)
  return rows.length
}

/** A document the schema refuses, carrying a value that must never be echoed. */
function anInvalidRuleSet() {
  const ruleSet = aRuleSet()
  ruleSet.rules[0] = { ...ruleSet.rules[0], mode: 'secret-mode-value' }
  return ruleSet
}

async function putFromDevice(
  client: ApiClient,
  token: string,
  ifMatch: string | null,
  ruleSet: unknown
) {
  const request = client.put('/api/v1/device/rule-set').json({ ruleSet })
  if (ifMatch !== null) request.header('If-Match', ifMatch)
  return request.asDevice(token)
}

test.group('Rule set sync: device routes', (group) => {
  group.each.setup(() => limiter.clear())
  group.each.teardown(() => app.container.restore(Clock))

  test('test an empty account answers revision 0 and a null rule set', async ({
    client,
    assert,
  }) => {
    const { token } = await enrolledDevice()

    const response = await client.get('/api/v1/device/rule-set').asDevice(token)

    response.assertStatus(200)
    response.assertHeader('etag', '"0"')
    response.assertHeader('cache-control', 'no-store')
    assert.deepEqual(response.body(), { revision: 0, ruleSet: null })
    const validate = contractValidator('RuleSetDocument')
    assert.isTrue(validate(response.body()), JSON.stringify(validate.errors))
  })

  test('test the first put with if-match 0 stores revision 1 and the get returns it', async ({
    client,
    assert,
  }) => {
    freezeTime('2026-01-05T09:00:00Z')
    const { device, token } = await enrolledDevice()
    const ruleSet = aRuleSet()

    const put = await putFromDevice(client, token, '"0"', ruleSet)

    put.assertStatus(200)
    put.assertHeader('etag', '"1"')
    assert.deepEqual(put.body(), { revision: 1 })
    assert.isTrue(contractValidator('RuleSetSaved')(put.body()))
    const row = await db.from(RULE_SETS_TABLE).where('user_id', device.userId).firstOrFail()
    assert.equal(row.revision, 1)
    assert.equal(row.content_hash, ruleSetContentHash(ruleSet))
    assert.equal(row.updated_by_device_id, device.id)
    assert.equal(new Date(row.updated_at).toISOString(), '2026-01-05T09:00:00.000Z')

    const get = await client.get('/api/v1/device/rule-set').asDevice(token)
    get.assertStatus(200)
    get.assertHeader('etag', '"1"')
    assert.deepEqual(get.body(), { revision: 1, ruleSet })
  })

  test('test if-none-match with the current revision answers 304', async ({ client }) => {
    const { token } = await enrolledDevice()
    await putFromDevice(client, token, '"0"', aRuleSet())

    const fresh = await client
      .get('/api/v1/device/rule-set')
      .header('If-None-Match', '"1"')
      .asDevice(token)
    const stale = await client
      .get('/api/v1/device/rule-set')
      .header('If-None-Match', '"0"')
      .asDevice(token)

    fresh.assertStatus(304)
    fresh.assertHeader('etag', '"1"')
    stale.assertStatus(200)
  })

  test('test stale if-match answers 412 with the current revision', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const { token: other } = await enrolledDevice(user)
    await putFromDevice(client, token, '"0"', aRuleSet(1))
    await putFromDevice(client, other, '"1"', aRuleSet(2))

    const stale = await putFromDevice(client, token, '"1"', aRuleSet(3))

    stale.assertStatus(412)
    stale.assertHeader('etag', '"2"')
    assert.deepEqual(stale.body(), { code: 'revision_mismatch', revision: 2 })
    assert.isTrue(contractValidator('RuleSetConflict')(stale.body()))
    const row = await db.from(RULE_SETS_TABLE).where('user_id', user.id).firstOrFail()
    assert.equal(row.revision, 2)
    assert.equal(row.content_hash, ruleSetContentHash(aRuleSet(2)))
  })

  test('test a missing if-match answers 412 and writes nothing', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()

    const response = await putFromDevice(client, token, null, aRuleSet())
    const weak = await putFromDevice(client, token, 'W/"0"', aRuleSet())

    response.assertStatus(412)
    assert.deepEqual(response.body(), { code: 'if_match_required', revision: 0 })
    weak.assertStatus(412)
    assert.equal(await storedRows(user.id), 0)
  })

  test('test invalid rule set answers 422 and keeps the stored one', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const stored = aRuleSet()
    await putFromDevice(client, token, '"0"', stored)

    const response = await putFromDevice(client, token, '"1"', anInvalidRuleSet())

    response.assertStatus(422)
    assert.deepEqual(response.body(), {
      code: 'validation_failed',
      fields: { 'ruleSet.rules.0.mode': 'schema' },
    })
    assert.notInclude(JSON.stringify(response.body()), 'secret-mode-value')
    const row = await db.from(RULE_SETS_TABLE).where('user_id', user.id).firstOrFail()
    assert.equal(row.revision, 1)
    assert.equal(row.content_hash, ruleSetContentHash(stored))
  })

  test('test a rule set over 256 KiB answers 422 too_large', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const huge = aRuleSet()
    huge.rules = Array.from({ length: 3000 }, (_, index) => ({
      id: `synthetic-${index}`,
      target: { kind: 'site', domain: `site${index}.example.com` },
      mode: 'block',
      schedules: [],
      enabled: true,
      note: 'x'.repeat(80),
    }))

    const response = await putFromDevice(client, token, '"0"', huge)

    response.assertStatus(422)
    assert.deepEqual(response.body(), {
      code: 'validation_failed',
      fields: { ruleSet: 'too_large' },
    })
    assert.equal(await storedRows(user.id), 0)
  })

  test('test a nul character in a note answers 422 and stores nothing', async ({
    client,
    assert,
  }) => {
    const { user, token } = await enrolledDevice()
    const ruleSet = aRuleSet()
    ruleSet.rules[0] = { ...ruleSet.rules[0], note: 'before\u0000after' }

    const response = await putFromDevice(client, token, '"0"', ruleSet)

    response.assertStatus(422)
    response.assertBody({ code: 'validation_failed', fields: { 'ruleSet.rules.0.note': 'schema' } })
    assert.equal(await storedRows(user.id), 0)
  })

  test('test a lone surrogate answers 422 and stores nothing', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const ruleSet = aRuleSet()
    // JSON.stringify sends it as the escape `\ud800`, which jsonb refuses.
    ruleSet.rules[0] = { ...ruleSet.rules[0], note: 'x\ud800' }

    const response = await putFromDevice(client, token, '"0"', ruleSet)

    response.assertStatus(422)
    response.assertBody({ code: 'validation_failed', fields: { 'ruleSet.rules.0.note': 'schema' } })
    assert.equal(await storedRows(user.id), 0)
  })

  test('test a deeply nested rule set answers 422 not 500', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const nestedRules = (depth: number) => {
      let deep: unknown = []
      for (let level = 0; level < depth; level++) deep = [deep]
      return { ...aRuleSet(), rules: deep }
    }

    const deep = await putFromDevice(client, token, '"0"', nestedRules(100))
    // Far deeper bodies are already refused by the body parser, never a 500.
    const deeper = await putFromDevice(client, token, '"0"', nestedRules(5000))

    deep.assertStatus(422)
    assert.deepEqual(deep.body().code, 'validation_failed')
    assert.isAtLeast(deeper.status(), 400)
    assert.isBelow(deeper.status(), 500)
    assert.equal(await storedRows(user.id), 0)
  })

  test('test an empty note round-trips unchanged', async ({ client, assert }) => {
    const { token } = await enrolledDevice()
    const ruleSet = aRuleSet()
    ruleSet.rules[0] = { ...ruleSet.rules[0], note: '' }

    const put = await putFromDevice(client, token, '"0"', ruleSet)
    const get = await client.get('/api/v1/device/rule-set').asDevice(token)

    put.assertStatus(200)
    assert.deepEqual(get.body().ruleSet, ruleSet)
  })

  test('test a rule set in the query string is never read', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const query = encodeURIComponent(JSON.stringify(aRuleSet()))

    const response = await client
      .put(`/api/v1/device/rule-set?ruleSet=${query}`)
      .header('If-Match', '"0"')
      .json({})
      .asDevice(token)

    response.assertStatus(422)
    assert.equal(await storedRows(user.id), 0)
  })

  test('test a missing rule set member answers 422', async ({ client }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .put('/api/v1/device/rule-set')
      .header('If-Match', '"0"')
      .json({})
      .asDevice(token)

    response.assertStatus(422)
    response.assertBody({ code: 'validation_failed', fields: { ruleSet: 'schema' } })
  })

  test('test an identical put keeps the revision', async ({ client, assert }) => {
    const { token } = await enrolledDevice()
    await putFromDevice(client, token, '"0"', aRuleSet())

    const again = await putFromDevice(client, token, '"1"', aRuleSet())

    again.assertStatus(200)
    assert.deepEqual(again.body(), { revision: 1 })
  })

  test("test another user's device cannot read the rule set", async ({ client, assert }) => {
    const { token: victim } = await enrolledDevice()
    const { user: attacker, token } = await enrolledDevice()
    await putFromDevice(client, victim, '"0"', aRuleSet())

    const read = await client.get('/api/v1/device/rule-set').asDevice(token)
    const write = await putFromDevice(client, token, '"1"', aRuleSet(9))

    assert.deepEqual(read.body(), { revision: 0, ruleSet: null })
    // The attacker's own set is revision 0, so "1" is stale for it.
    write.assertStatus(412)
    assert.equal(await storedRows(attacker.id), 0)
  })

  test('test rule set writes are throttled per device', async ({ client }) => {
    const { token } = await enrolledDevice()
    let last = 200
    for (let attempt = 0; attempt < 61; attempt++) {
      const response = await putFromDevice(client, token, null, aRuleSet())
      last = response.status()
    }
    if (last !== 429) throw new Error(`expected 429, got ${last}`)
  })
})

test.group('Rule set sync: heartbeat', (group) => {
  group.each.setup(async () => {
    await limiter.clear()
    await bootKeys()
  })
  group.each.teardown(() => app.container.restore(Clock))

  test('test heartbeat reports the current rule set revision', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    const { device: other, token: otherToken } = await enrolledDevice(user)
    await putFromDevice(client, otherToken, '"0"', aRuleSet(1))
    await putFromDevice(client, otherToken, '"1"', aRuleSet(2))

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(await heartbeatBody({ ruleSetRevision: 1 }))
      .asDevice(token)

    response.assertStatus(200)
    assert.equal(response.body().rulesVersion, 2)
    assert.isTrue(contractValidator('HeartbeatResponse')(response.body()))
    const heartbeatDevice = await Device.query()
      .where('user_id', user.id)
      .whereNot('id', other.id)
      .firstOrFail()
    assert.equal(heartbeatDevice.ruleSetRevision, 1)
    const beat = await db
      .from(DEVICE_HEARTBEATS_TABLE)
      .where('device_id', heartbeatDevice.id)
      .firstOrFail()
    assert.equal(beat.rule_set_revision, 1)
  })

  test('test a heartbeat without a rule set revision still validates', async ({
    client,
    assert,
  }) => {
    const { device, token } = await enrolledDevice()

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(await heartbeatBody())
      .asDevice(token)

    response.assertStatus(200)
    assert.equal(response.body().rulesVersion, 0)
    await device.refresh()
    assert.isNull(device.ruleSetRevision)
  })

  test('test a malformed rule set revision answers 422', async ({ client }) => {
    const { token } = await enrolledDevice()

    const response = await client
      .post('/api/v1/device/heartbeat')
      .json(await heartbeatBody({ ruleSetRevision: -1 }))
      .asDevice(token)

    response.assertStatus(422)
  })
})

test.group('Rule set sync: dashboard routes', (group) => {
  group.each.setup(() => limiter.clear())

  test('test the user reads and writes the rule set with the same if-match semantics', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()

    const empty = await client.get('/api/v1/rule-set').actingAs(user)
    const missing = await client
      .put('/api/v1/rule-set')
      .json({ ruleSet: aRuleSet() })
      .actingAs(user)
    const saved = await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"0"')
      .json({ ruleSet: aRuleSet() })
      .actingAs(user)
    const stale = await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"0"')
      .json({ ruleSet: aRuleSet(2) })
      .actingAs(user)

    empty.assertStatus(200)
    assert.deepEqual(empty.body(), { revision: 0, ruleSet: null })
    missing.assertStatus(412)
    assert.equal(missing.body().code, 'E_RULE_SET_IF_MATCH_REQUIRED')
    saved.assertStatus(200)
    saved.assertHeader('etag', '"1"')
    assert.deepEqual(saved.body(), { revision: 1 })
    stale.assertStatus(412)
    assert.equal(stale.body().code, 'E_RULE_SET_REVISION_MISMATCH')
    assert.equal(stale.body().revision, 1)
    assert.isString(stale.body().message)
    const row = await db.from(RULE_SETS_TABLE).where('user_id', user.id).firstOrFail()
    assert.isNull(row.updated_by_device_id)
  })

  test('test a web write is what the devices pull', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"0"')
      .json({ ruleSet: aRuleSet() })
      .actingAs(user)

    const pulled = await client.get('/api/v1/device/rule-set').asDevice(token)

    assert.deepEqual(pulled.body(), { revision: 1, ruleSet: aRuleSet() })
  })

  test('test an invalid web rule set answers 422 with paths only', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const response = await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"0"')
      .json({ ruleSet: anInvalidRuleSet() })
      .actingAs(user)

    response.assertStatus(422)
    assert.deepEqual(
      response
        .body()
        .errors.map((error: { field: string; rule: string }) => [error.field, error.rule]),
      [['ruleSet.rules.0.mode', 'schema']]
    )
    assert.notInclude(JSON.stringify(response.body()), 'secret-mode-value')
  })

  test("test a guardian cannot read the ward's rule set", async ({ client, assert }) => {
    const { ward, guardian } = await guardianPair({ state: 'active' })
    const { token } = await enrolledDevice(ward)
    await putFromDevice(client, token, '"0"', aRuleSet())

    const read = await client.get('/api/v1/rule-set').actingAs(guardian)
    const write = await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"1"')
      .json({ ruleSet: aRuleSet(5) })
      .actingAs(guardian)

    // The guardian only ever reaches their own (empty) set.
    assert.deepEqual(read.body(), { revision: 0, ruleSet: null })
    write.assertStatus(412)
    const row = await db.from(RULE_SETS_TABLE).where('user_id', ward.id).firstOrFail()
    assert.equal(row.revision, 1)
    assert.notInclude(JSON.stringify(read.body()), 'example.com')
  })

  test('test a guardian-only account has no rule set', async ({ client, assert }) => {
    const guardian = await UserFactory.merge({ guardianOnly: true }).create()

    const read = await client.get('/api/v1/rule-set').actingAs(guardian)
    const write = await client
      .put('/api/v1/rule-set')
      .header('If-Match', '"0"')
      .json({ ruleSet: aRuleSet() })
      .actingAs(guardian)

    read.assertStatus(403)
    read.assertBodyContains({ code: 'E_GUARDIAN_ONLY_ACCOUNT' })
    write.assertStatus(403)
    assert.equal(await storedRows(guardian.id), 0)
  })

  test('test a device token cannot use the dashboard route', async ({ client }) => {
    const { token } = await enrolledDevice()

    const response = await client.get('/api/v1/rule-set').asDevice(token)

    response.assertStatus(401)
  })
})

test.group('Rule set sync: export and deletion', (group) => {
  group.each.setup(() => limiter.clear())

  test('test the account export includes the rule set', async ({ client, assert }) => {
    const { user, device, token } = await enrolledDevice()
    const ruleSet = aRuleSet()
    await putFromDevice(client, token, '"0"', ruleSet)

    const exported = await client.get('/api/v1/me/export').actingAs(user)

    exported.assertStatus(200)
    assert.deepEqual(exported.body().ruleSet, {
      revision: 1,
      contentHash: ruleSetContentHash(ruleSet),
      updatedAt: exported.body().ruleSet.updatedAt,
      updatedByDeviceUuid: device.uuid,
      document: ruleSet,
    })
  })

  test('test an account without a rule set exports null', async ({ client, assert }) => {
    const user = await UserFactory.create()

    const exported = await client.get('/api/v1/me/export').actingAs(user)

    assert.isNull(exported.body().ruleSet)
  })

  test('test account deletion removes the rule set', async ({ client, assert }) => {
    const { user, token } = await enrolledDevice()
    await putFromDevice(client, token, '"0"', aRuleSet())

    const deletion = await app.container.make(AccountDeletion)
    await deletion.delete(await User.findOrFail(user.id))

    assert.equal(await storedRows(user.id), 0)
  })
})
