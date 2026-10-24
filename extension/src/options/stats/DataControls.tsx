// SPDX-License-Identifier: AGPL-3.0-or-later
import { Download, Trash2 } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import type { DownloadFile } from '../../pages/FileDownload'
import type { CommandClient } from '../../shared/CommandClient'
import type { ExportFormat } from '../../shared/LocalDataContract'
import { Banner } from '../../ui/Banner'
import { Button } from '../../ui/Button'

export interface DataControlsProps {
  client: CommandClient
  download: DownloadFile
  onDeleted: () => void
}

type Status = 'idle' | 'confirming' | 'deleted' | 'failed'

/**
 * Export (ActivityWatch JSON, CSV) and "Delete all local data". Deleting
 * asks again in the page (never `window.confirm`), with Cancel focused.
 */
export function DataControls({ client, download, onDeleted }: DataControlsProps) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')

  const exportAs = (format: ExportFormat) => {
    client
      .send('data.export', { format })
      .then(download)
      .catch(() => setStatus('failed'))
  }
  const deleteAll = () => {
    client
      .send('data.deleteAll', {})
      .then(() => {
        setStatus('deleted')
        onDeleted()
      })
      .catch(() => setStatus('failed'))
  }

  return (
    <section class="options__block" aria-labelledby="options-data">
      <h3 id="options-data" class="options__subheading">
        {t('stats.data.title')}
      </h3>
      <p class="options__muted">{t('stats.data.body')}</p>
      <div class="options__actions">
        <Button variant="secondary" icon={Download} onClick={() => exportAs('activitywatch')}>
          {t('stats.data.exportActivityWatch')}
        </Button>
        <Button variant="secondary" icon={Download} onClick={() => exportAs('csv')}>
          {t('stats.data.exportCsv')}
        </Button>
      </div>
      <div role="status">
        {status === 'deleted' ? <Banner tone="notice" message={t('stats.data.deleted')} /> : null}
        {status === 'failed' ? <Banner tone="error" message={t('stats.data.failed')} /> : null}
      </div>
      {status === 'confirming' ? (
        <div class="options__confirm" role="group" aria-labelledby="options-delete-confirm">
          <h4 id="options-delete-confirm" class="options__subheading">
            {t('stats.data.confirmTitle')}
          </h4>
          <p>{t('stats.data.confirmBody')}</p>
          <div class="options__actions">
            <Button variant="destructive" icon={Trash2} onClick={deleteAll}>
              {t('stats.data.confirmDelete')}
            </Button>
            <Button variant="secondary" autoFocus onClick={() => setStatus('idle')}>
              {t('stats.data.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div class="options__actions">
          <Button variant="destructive" icon={Trash2} onClick={() => setStatus('confirming')}>
            {t('stats.data.delete')}
          </Button>
        </div>
      )}
    </section>
  )
}
