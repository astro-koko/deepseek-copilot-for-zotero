# Deepseek Copliot Sidebar Host-Tone Design

Date: 2026-06-01
Status: Approved for implementation
Scope: B-scope frontend convergence for the Zotero right sidebar

## Goal

Make the Deepseek Copliot sidebar feel like a native Zotero right-pane tool surface instead of a self-contained web assistant page.

This pass improves visual and structural integration only. It does not change send logic, persistence, host mounting, or packaged smoke criteria.

## Non-Goals

- no changes to `chatSessionStore`, thread persistence, or provider behavior
- no changes to native host attachment or pane visibility logic
- no new settings surface or provider controls
- no attempt to solve the current "draft clears but visible thread state does not settle" blocker

## Current Problem

The sidebar is already mounted inside Zotero's native Library and Reader panes, but the UI still reads like a standalone web chat product:

- full-pane gradient background
- multiple large rounded cards
- strong branded header and badge treatment
- web-style blue chat bubbles and blue send button
- verbose hero/onboarding copy
- suggested actions and recent chats rendered as button cards instead of compact lists

This creates a mismatch with Zotero's denser, quieter, section-based right-pane language.

## Target Outcome

After this pass, the sidebar should:

- use a neutral pane background that can sit inside Zotero without drawing a separate visual frame
- reduce card count and radius so content reads as stacked sections instead of a dashboard
- collapse the header into a light title row with subdued status
- present scope, suggestions, recents, thread content, and composer as compact pane sections
- use shorter, more operational copy in empty/home/config states
- keep enough identity to remain recognizable as Deepseek Copliot without competing with the host UI

## Component-Level Changes

### Sidebar Shell

- remove the full-pane warm gradient
- reduce padding and vertical gaps
- replace the current strong branded header with a compact title row
- remove the provider pill and replace the status pill with plain muted status text or a very light badge
- keep the three top actions (`New Thread`, `Recent Chats`, `Settings`) but restyle them as small, low-emphasis tool buttons

### Scope Section

- convert the current scope card into a compact information band
- keep scope type, scope label, selection/context metadata, and warnings
- reduce badge weight and limit color use to secondary emphasis only

### Home / Empty / Config States

- remove the current hero-card feel
- keep the same logical states from `sidebarViewModel`, but shorten titles and body copy
- preserve the configuration notice and settings affordance while restyling it as an inline pane notice instead of a promotional card

### Suggested Actions

- keep existing preset behavior and ordering
- render actions as compact stacked rows with title and short subtext
- make the section feel like a tool list instead of a grid of product cards

### Recent Chats

- keep recent-thread behavior unchanged
- render each recent thread as a compact list row with title, preview, and timestamp
- avoid large rounded card buttons

### Thread View

- keep message ordering and scrolling behavior unchanged
- restyle user, assistant, and system messages with lighter, host-friendly neutrals
- remove the strong saturated blue user bubble
- keep errors and streaming states visible, but reduce decorative framing

### Composer

- keep submit, cancel, slash presets, disabled behavior, and focus behavior unchanged
- restyle the composer as a quieter pane footer input area
- reduce textarea height, corner radius, shadow, and accent saturation
- make the slash preset menu look like a compact host popup rather than a floating web menu

## File Scope

Primary implementation files:

- `src/ui/components/Sidebar.tsx`
- `src/ui/components/Composer.tsx`
- `src/ui/components/ThreadView.tsx`
- `src/ui/components/sidebarViewModel.ts`

Primary verification files:

- `src/ui/components/sidebarViewModel.test.ts`
- optionally add focused component tests if the existing test setup supports cheap structure assertions

## Acceptance Criteria

This pass is complete when:

- the sidebar no longer uses the current full-pane gradient and card-heavy presentation
- header, scope, suggestions, recents, thread area, and composer all present as compact Zotero-like right-pane sections
- home/config/empty copy is materially shorter and more tool-like
- existing sidebar behavior tests still pass
- any newly added UI-shape assertions pass

This pass is not allowed to claim:

- host lifecycle is fully accepted
- send-state settlement is fixed
- packaged `.xpi` acceptance is complete

