// SPDX-License-Identifier: AGPL-3.0-or-later
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/preact'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its own
// automatic cleanup; unmount every render after each spec.
afterEach(() => {
  cleanup()
})
