// SPDX-License-Identifier: AGPL-3.0-or-later
import { startPage } from '../../ui/startPage'

// The intention gate (E6). It must never read its destination from the query
// string (`?to=`): the target comes from the per-tab state in the service worker.
void startPage({ titleKey: 'gate.title' })
