// SPDX-License-Identifier: AGPL-3.0-or-later
import { DevGallery } from '../../dev/DevGallery'
import { systemClock } from '../../shared/clock'
import { startPage } from '../../ui/startPage'

void startPage({ titleKey: 'dev.title', content: <DevGallery clock={systemClock} /> })
