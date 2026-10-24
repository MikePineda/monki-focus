// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RejectionCode, Ruleset } from '@monki-focus/rules/pure'
import { Download, Upload } from 'lucide-preact'
import type { TargetedEvent } from 'preact'
import { useRef } from 'preact/hooks'
import { useI18n } from '../../i18n/I18nContext'
import type { DownloadFile } from '../../pages/FileDownload'
import type { ExportedFile } from '../../shared/LocalDataContract'
import { validateRulesetDocument } from '../../shared/RulesetValidation'
import { Button } from '../../ui/Button'

/** The configured rule set as a JSON file, named by its last change. */
export function rulesetFile(ruleset: Ruleset): ExportedFile {
  return {
    fileName: `monki-focus-rules-${ruleset.updatedAt.slice(0, 10)}.json`,
    mimeType: 'application/json',
    text: `${JSON.stringify(ruleset, null, 2)}\n`,
  }
}

export interface RulesetTransferProps {
  ruleset: Ruleset
  onPropose: (next: Ruleset) => Promise<boolean>
  onInvalidImport: (code: RejectionCode) => void
  download: DownloadFile
}

/**
 * Export the configured rule set as JSON; import one, validated with the
 * rules schemas, then proposed like any edit (a looser import waits).
 */
export function RulesetTransfer({
  ruleset,
  onPropose,
  onInvalidImport,
  download,
}: RulesetTransferProps) {
  const { t } = useI18n()
  const picker = useRef<HTMLInputElement>(null)

  const importFile = async (event: TargetedEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    const text = await file.text()
    input.value = ''
    const result = validateRulesetDocument(text)
    if (!result.valid) {
      onInvalidImport(result.code)
      return
    }
    await onPropose(result.ruleset)
  }

  return (
    <section class="options__block" aria-labelledby="options-transfer">
      <h3 id="options-transfer" class="options__subheading">
        {t('rules.transfer.title')}
      </h3>
      <p class="options__muted">{t('rules.transfer.body')}</p>
      <div class="options__actions">
        <Button variant="secondary" icon={Download} onClick={() => download(rulesetFile(ruleset))}>
          {t('rules.transfer.export')}
        </Button>
        <Button variant="secondary" icon={Upload} onClick={() => picker.current?.click()}>
          {t('rules.transfer.import')}
        </Button>
        <input
          ref={picker}
          hidden
          tabIndex={-1}
          type="file"
          accept="application/json,.json"
          data-testid="ruleset-import"
          onChange={(event) => void importFile(event)}
        />
      </div>
    </section>
  )
}
