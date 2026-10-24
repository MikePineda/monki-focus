// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ExportedFile } from '../shared/LocalDataContract'

export type DownloadFile = (file: ExportedFile) => void

/**
 * Saves a file the page built (the user's own export) through a temporary
 * object URL and an anchor click: no `downloads` permission, nothing leaves
 * the device.
 */
export const downloadFile: DownloadFile = ({ fileName, mimeType, text }) => {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
