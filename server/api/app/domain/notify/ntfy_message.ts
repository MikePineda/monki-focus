// SPDX-License-Identifier: AGPL-3.0-or-later
import type { NotificationPayload } from '#domain/notify/notification_payload'

/**
 * The JSON ntfy publishes (`POST {NTFY_BASE_URL}` with the topic in the
 * body), built from an outbox payload. Text comes only from the i18n
 * catalog (`notifications.*` keys) through `translate`, already bound to
 * the recipient's locale. The message carries the minimum: a reason code
 * turned into words and a number of minutes; never the scope, the user's
 * reason or a name.
 *
 * An unlock request gets at most three actions: approve and deny as
 * single-use http POSTs to absolute capability URLs, and a view of the
 * request in the dashboard. With `allowActions` false (strict mode) or no
 * tokens left (expired seal), only the view.
 */
export const NTFY_MAX_ACTIONS = 3
export const UNLOCK_REQUEST_PRIORITY = 4
export const DEFAULT_PRIORITY = 3

export type NtfyAction =
  | {
      readonly action: 'http'
      readonly label: string
      readonly url: string
      readonly method: 'POST'
      readonly clear?: boolean
    }
  | { readonly action: 'view'; readonly label: string; readonly url: string }

export interface NtfyMessage {
  readonly topic: string
  readonly title: string
  readonly message: string
  readonly priority: number
  readonly tags: readonly string[]
  readonly actions: readonly NtfyAction[]
}

export type Translate = (key: string, params?: Record<string, string | number>) => string

export interface NtfyMessageContext {
  readonly topic: string
  /** Canonical origin of the instance (APP_URL), no trailing slash. */
  readonly appUrl: string
  readonly translate: Translate
  /** The link's `allow_notification_actions`. */
  readonly allowActions: boolean
  /** The plain action tokens of an unlock request, when still sealed in the row. */
  readonly actionTokens?: { readonly approve: string; readonly deny: string } | null
  /** An instant written for the recipient (locale and time zone). */
  readonly formatInstant: (iso: string) => string
}

export function actionUrl(appUrl: string, token: string): string {
  return `${trimSlash(appUrl)}/api/v1/actions/${token}`
}

export function requestViewUrl(appUrl: string, requestUuid: string): string {
  return `${trimSlash(appUrl)}/guardian/requests/${requestUuid}`
}

export function ntfyMessage(
  payload: NotificationPayload,
  context: NtfyMessageContext
): NtfyMessage {
  const { translate: t, topic } = context
  switch (payload.type) {
    case 'unlock_request': {
      const minutes = payload.minutes
      const actions: NtfyAction[] = []
      if (context.allowActions && context.actionTokens) {
        actions.push(
          {
            action: 'http',
            label: t('notifications.unlock_request.approve', { minutes }),
            url: actionUrl(context.appUrl, context.actionTokens.approve),
            method: 'POST',
            clear: true,
          },
          {
            action: 'http',
            label: t('notifications.unlock_request.deny'),
            url: actionUrl(context.appUrl, context.actionTokens.deny),
            method: 'POST',
          }
        )
      }
      actions.push({
        action: 'view',
        label: t('notifications.unlock_request.view'),
        url: requestViewUrl(context.appUrl, payload.requestUuid),
      })
      return {
        topic,
        title: t('notifications.unlock_request.title'),
        message: t('notifications.unlock_request.message', { minutes }),
        priority: UNLOCK_REQUEST_PRIORITY,
        tags: ['unlock'],
        actions: actions.slice(0, NTFY_MAX_ACTIONS),
      }
    }
    case 'unlock_decided':
      return {
        topic,
        title: t(`notifications.unlock_decided.${payload.decision}.title`),
        message: t(`notifications.unlock_decided.${payload.decision}.message`, {
          minutes: payload.minutes,
        }),
        priority: DEFAULT_PRIORITY,
        tags: [payload.decision === 'approved' ? 'white_check_mark' : 'x'],
        actions: [],
      }
    case 'bypass_alert':
      return {
        topic,
        title: t('notifications.bypass_alert.title'),
        message: t('notifications.bypass_alert.message'),
        priority: UNLOCK_REQUEST_PRIORITY,
        tags: ['warning'],
        actions: [],
      }
    case 'guardian_notice':
      return {
        topic,
        title: t(`notifications.guardian_notice.${payload.kind}.title`),
        message: t(`notifications.guardian_notice.${payload.kind}.message`, {
          effectiveAt: payload.effectiveAt ? context.formatInstant(payload.effectiveAt) : '',
        }),
        priority: DEFAULT_PRIORITY,
        tags: ['information_source'],
        actions: [],
      }
  }
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
