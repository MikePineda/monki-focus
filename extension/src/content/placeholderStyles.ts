// SPDX-License-Identifier: AGPL-3.0-or-later
// The placeholder's shadow root gets its CSS as text: content-script CSS is
// never injected into the page itself (`cssInjectionMode: 'manual'`), so the
// tokens and the UI kit styles only exist inside the shadow root.
import tokensCss from '../theme/tokens.css?inline'
import buttonCss from '../ui/Button.css?inline'
import levelDotCss from '../ui/LevelDot.css?inline'
import listRowCss from '../ui/ListRow.css?inline'
import textFieldCss from '../ui/TextField.css?inline'
import placeholderCss from './FeedPlaceholder.css?inline'

/** Every stylesheet the feed placeholder renders with, in cascade order. */
export const PLACEHOLDER_CSS = [
  tokensCss,
  buttonCss,
  textFieldCss,
  listRowCss,
  levelDotCss,
  placeholderCss,
].join('\n')
