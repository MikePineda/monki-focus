// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import UserResetPassword from '#commands/user_reset_password'
import { UserFactory } from '#tests/factories/user_factory'

const NEW_PASSPHRASE = ['copper', 'walrus', 'tundra', 'six'].join(' ')

test.group('node ace user:reset-password', (group) => {
  group.each.setup(() => ace.ui.switchMode('raw'))
  group.each.teardown(() => ace.ui.switchMode('normal'))

  test('test_it_sets_the_typed_password_and_signs_the_account_out_everywhere', async ({
    assert,
  }) => {
    const user = await UserFactory.create()
    const command = await ace.create(UserResetPassword, [user.email.toUpperCase()])
    command.prompt.trap('New password').replyWith(NEW_PASSPHRASE)
    command.prompt.trap('Repeat the new password').replyWith(NEW_PASSPHRASE)

    await command.exec()

    command.assertSucceeded()
    await user.refresh()
    assert.isTrue(await user.verifyPassword(NEW_PASSPHRASE))
    assert.equal(user.sessionVersion, 1)
    const output = JSON.stringify(command.ui.logger.getLogs())
    assert.include(output, `user #${user.id}`)
    assert.notInclude(output, user.email)
  })

  test('test_generate_prints_a_strong_password_once', async ({ assert }) => {
    const user = await UserFactory.create()
    const command = await ace.create(UserResetPassword, [user.email, '--generate'])

    await command.exec()

    command.assertSucceeded()
    const line = command.ui.logger
      .getLogs()
      .map((log) => log.message)
      .find((message) => message.includes('shown once'))!
    const generated = line.split(': ').pop()!
    assert.lengthOf(generated, 24)
    await user.refresh()
    assert.isTrue(await user.verifyPassword(generated))
  })

  test('test_mismatched_or_weak_passwords_change_nothing', async ({ assert }) => {
    const user = await UserFactory.create()

    const mismatch = await ace.create(UserResetPassword, [user.email])
    mismatch.prompt.trap('New password').replyWith(NEW_PASSPHRASE)
    mismatch.prompt.trap('Repeat the new password').replyWith('something else entirely')
    await mismatch.exec()
    mismatch.assertFailed()

    const weak = await ace.create(UserResetPassword, [user.email])
    weak.prompt.trap('New password').replyWith('password1234')
    weak.prompt.trap('Repeat the new password').replyWith('password1234')
    await weak.exec()
    weak.assertFailed()

    await user.refresh()
    assert.equal(user.sessionVersion, 0)
  })

  test('test_an_unknown_email_fails', async () => {
    const command = await ace.create(UserResetPassword, ['nobody-here@example.com', '--generate'])

    await command.exec()

    command.assertFailed()
  })

  test('test_disable_two_factor_turns_totp_off', async ({ assert }) => {
    const user = await UserFactory.merge({
      totpSecretEncrypted: 'opaque',
      totpLastUsedStep: 42,
    }).create()
    user.totpEnabledAt = user.createdAt
    await user.save()

    const command = await ace.create(UserResetPassword, [
      user.email,
      '--generate',
      '--disable-two-factor',
    ])
    await command.exec()

    command.assertSucceeded()
    await user.refresh()
    assert.isFalse(user.twoFactorEnabled)
    assert.isNull(user.totpSecretEncrypted)
  })
})
