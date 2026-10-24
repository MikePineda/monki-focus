// SPDX-License-Identifier: AGPL-3.0-or-later
import { ArrowRightLeft, Inbox, MessageCircle, Search, Users } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { useI18n } from '../i18n/I18nContext'
import type { SimpleKey } from '../i18n/t'
import type { PlaceholderPart, SiteFeedProfile } from '../sites/SiteFeedProfile'
import { Button } from '../ui/Button'
import type { LucideIcon } from '../ui/Icon'
import { ListRow } from '../ui/ListRow'
import { TextField } from '../ui/TextField'
import './FeedPlaceholder.css'

export interface FeedPlaceholderProps {
  site: SiteFeedProfile
  /** Opens a path of the page's own site (`location.assign`). */
  navigate: (path: string) => void
  /** Selects a tab of the page itself (X: Following). */
  activateTab: (selector: string) => void
}

const LINK_ICONS: Partial<Record<SimpleKey, LucideIcon>> = {
  'feedPlaceholder.direct': MessageCircle,
  'feedPlaceholder.subscriptions': Inbox,
  'feedPlaceholder.search': Search,
}

function SearchPart({
  part,
  siteName,
  navigate,
}: {
  part: Extract<PlaceholderPart, { kind: 'search' }>
  siteName: string
  navigate: (path: string) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const submit = () => {
    const trimmed = query.trim()
    if (trimmed === '') return
    navigate(`${part.action}?${new URLSearchParams({ [part.param]: trimmed }).toString()}`)
  }
  return (
    <form
      class="mf-feed-placeholder__search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <TextField
        label={t('feedPlaceholder.searchLabel', { site: siteName })}
        value={query}
        onInput={setQuery}
        onSubmit={submit}
      />
      <Button variant="ink" type="submit" icon={Search}>
        {t('feedPlaceholder.searchSubmit')}
      </Button>
    </form>
  )
}

function CommunitiesPart() {
  const { t } = useI18n()
  return (
    <section class="mf-feed-placeholder__communities">
      <h3 class="mf-feed-placeholder__subtitle">{t('feedPlaceholder.communities')}</h3>
      <p class="mf-feed-placeholder__empty">{t('feedPlaceholder.communitiesEmpty')}</p>
    </section>
  )
}

/**
 * Stands where the feed was: says the feed is hidden by the user's own rule
 * and offers the useful parts of the site (search, Following, Subscriptions,
 * Direct, the allowed communities). Every text comes from the catalogs; the
 * placeholder shows nothing taken from the page.
 */
export function FeedPlaceholder({ site, navigate, activateTab }: FeedPlaceholderProps) {
  const { t } = useI18n()
  const siteName = t(site.nameKey)
  const rows = site.placeholder.filter(
    (part): part is Extract<PlaceholderPart, { kind: 'link' | 'tab' }> =>
      part.kind === 'link' || part.kind === 'tab'
  )

  return (
    <section class="mf-feed-placeholder" aria-label={t('feedPlaceholder.title')}>
      <h2 class="mf-feed-placeholder__title">{t('feedPlaceholder.title')}</h2>
      <p class="mf-feed-placeholder__body">{t('feedPlaceholder.body', { site: siteName })}</p>
      {site.placeholder.map((part) =>
        part.kind === 'search' ? (
          <SearchPart key="search" part={part} siteName={siteName} navigate={navigate} />
        ) : null
      )}
      {rows.length > 0 ? (
        <ul class="mf-feed-placeholder__links">
          {rows.map((part) =>
            part.kind === 'link' ? (
              <ListRow
                key={part.href}
                primary={t(part.labelKey)}
                href={part.href}
                leading={{ icon: LINK_ICONS[part.labelKey] ?? ArrowRightLeft }}
              />
            ) : (
              <ListRow
                key={part.selector}
                primary={t(part.labelKey)}
                onClick={() => activateTab(part.selector)}
                leading={{ icon: Users }}
              />
            )
          )}
        </ul>
      ) : null}
      {site.placeholder.some((part) => part.kind === 'communities') ? <CommunitiesPart /> : null}
    </section>
  )
}
