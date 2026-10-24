// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The i18n key of a decision (SEMANTICS.md §5.4), fixed by the primary
 * outcome. For `rule_match`: `decision.blocked_by_rule` when access is
 * `block`, else `decision.feed_hidden` when content is `hide-feed`, else
 * `decision.allowed_by_rule`; every other reason maps to `decision.<reason>`.
 * The domain never returns text.
 */
import type { Access, Content, ExplanationKey, ReasonCode } from '@monki-focus/rules'

export function explanationKeyOf(
  access: Access,
  content: Content,
  reason: ReasonCode
): ExplanationKey {
  if (reason !== 'rule_match') return `decision.${reason}`
  if (access === 'block') return 'decision.blocked_by_rule'
  return content === 'hide-feed' ? 'decision.feed_hidden' : 'decision.allowed_by_rule'
}
