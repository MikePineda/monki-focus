// SPDX-License-Identifier: AGPL-3.0-or-later
// The intention pill and timeout overlay get their CSS as text inside their
// shadow root only (`cssInjectionMode: 'manual'`), like the feed placeholder.
import tokensCss from '../theme/tokens.css?inline'
import buttonCss from '../ui/Button.css?inline'
import overlayCardCss from '../ui/OverlayCard.css?inline'
import sessionOverlayCss from './SessionOverlay.css?inline'

/** Every stylesheet the pill and the timeout overlay render with, in cascade order. */
export const SESSION_OVERLAY_CSS = [tokensCss, buttonCss, overlayCardCss, sessionOverlayCss].join(
  '\n'
)
