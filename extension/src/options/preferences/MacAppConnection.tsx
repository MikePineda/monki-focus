// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import {
  NATIVE_MESSAGING_PERMISSION,
  type OptionalPermissionsApi,
} from '../../shared/NativeMessagingPermission'
import { Banner } from '../../ui/Banner'
import { Button } from '../../ui/Button'

export interface MacAppConnectionProps {
  permissions: OptionalPermissionsApi
}

const NATIVE_MESSAGING = { permissions: [NATIVE_MESSAGING_PERMISSION] }

/**
 * "Connect the Mac app": the only place the optional `nativeMessaging`
 * permission is requested (the click is the user gesture the browser needs).
 * The service worker starts the bridge when it is granted and stops it when
 * it is removed; without it the extension works on its own.
 */
export function MacAppConnection({ permissions }: MacAppConnectionProps) {
  const { t } = useI18n()
  const [granted, setGranted] = useState<boolean | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    permissions
      .contains(NATIVE_MESSAGING)
      .then(setGranted)
      .catch(() => setGranted(false))
  }, [permissions])

  const connect = async () => {
    const ok = await permissions.request(NATIVE_MESSAGING).catch(() => false)
    setDenied(!ok)
    setGranted(ok)
  }

  const disconnect = async () => {
    await permissions.remove(NATIVE_MESSAGING).catch(() => false)
    setGranted(await permissions.contains(NATIVE_MESSAGING).catch(() => false))
  }

  return (
    <section class="options__block" aria-labelledby="options-mac-app">
      <h3 id="options-mac-app" class="options__subheading">
        {t('preferences.macApp')}
      </h3>
      <p class="options__muted">{t('preferences.macApp.description')}</p>
      {denied ? <Banner message={t('preferences.macApp.denied')} /> : null}
      {granted === true ? (
        <>
          <p>{t('preferences.macApp.connected')}</p>
          <Button variant="secondary" onClick={() => void disconnect()}>
            {t('preferences.macApp.disconnect')}
          </Button>
        </>
      ) : null}
      {granted === false ? (
        <Button variant="ink" onClick={() => void connect()}>
          {t('preferences.macApp.connect')}
        </Button>
      ) : null}
    </section>
  )
}
