// SPDX-License-Identifier: AGPL-3.0-or-later
import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { PageShell } from '../../../src/ui/PageShell'

describe('PageShell', () => {
  it('page_shell_is_the_main_landmark_with_one_level_one_heading', () => {
    render(
      <PageShell title="Today">
        <p>Body</p>
      </PageShell>
    )
    expect(screen.getByRole('main')).toContainElement(screen.getByText('Body'))
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Today')
  })
})
