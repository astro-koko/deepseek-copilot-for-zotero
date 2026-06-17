# Deepseek Copliot Reader Session Isolation Design

Status: Active execution spec
Owner: AgentPaper
Related issue: Reader blank sidebar and cross-document conversation isolation
Target release: next host-stability release

## Classification

Classification: `bug` plus `feature`.

Affected Zotero surfaces:

- Library right-side pane
- Reader right-side pane
- Reader popup/menu handoff
- persistence
- local thread history
- packaged XPI smoke

## Problem

The Reader right-side pane can show the native `Deepseek Copliot` section header while the plugin body is blank in some PDF reading states. The current session model also lets one global active thread follow scope changes across different papers and PDFs. That creates mixed histories such as one thread being rewritten from Paper A to Paper B with a `Context switched to:` system message.

The user's expected model is document-scoped: each paper or PDF has its own conversation pool, and switching between open PDF tabs should restore the correct conversation state for the active document.

## Goals

- Keep the official content surface as Zotero's native right-side pane in Library and Reader.
- Prevent Reader handoff events from being ignored when Zotero reports reader-like tab types such as `reader-preview` or `reader-loading`.
- Make blank React sidebar failures visible with an error fallback instead of an empty pane.
- Introduce a stable scope key for paper/PDF conversations.
- Load recent conversations for the current paper/PDF before falling back to global recent history.
- Stop automatically rewriting the active thread's scope when the user switches documents.
- Preserve legacy threads by deriving scope keys from existing `scopeSnapshot` values at read time.

## Non-goals

- Do not add a cloud sync or remote thread service.
- Do not change provider behavior, model prompts, API key settings, or evidence search.
- Do not create one React host per PDF tab.
- Do not change Deepseek Copliot branding, icons, or official Zotero right-pane ownership.
- Do not edit Zotero profile registries, installed extensions, cookies, or databases by hand.

## User Workflow

1. The user opens several PDF Reader tabs.
2. The right-side `Deepseek Copliot` section appears with a visible body for each active Reader tab.
3. The user asks a question in PDF A.
4. The user switches to PDF B and sees PDF B's conversation pool, not PDF A's thread.
5. The user switches back to PDF A and the prior PDF A thread is available again.
6. `Explain` auto-sends in the active PDF's conversation context.
7. `Ask...` pre-fills the active PDF's composer without changing another document's thread.

## Scope And Boundaries

In scope:

- `reader-host` lane changes for Reader tab type matching and sidebar fallback visibility.
- session/persistence changes needed to key thread history by current paper/PDF.
- focused Vitest coverage for the behavior change.
- development XPI build verification.

Out of scope:

- public release profile smoke execution in this task.
- provider round-trip quality work.
- schema migration that requires direct user data rewrites outside Zotero.DB APIs.

Privacy boundary:

- Thread history remains local in Zotero.DB.
- No API keys, profile paths, data directories, cookies, SQLite files, or full PDF text are logged or exported.
- Scope keys may include Zotero item IDs and library IDs, which are local metadata and must not be sent externally.

## Design Decisions

### Stable Scope Key

Add `scopeKey?: string` to `ScopeContext` and derive it as:

- `paper:<itemId>` for regular items.
- `pdf:<attachmentId>` for PDF attachments and Reader PDFs.
- existing `scope.id` as a fallback for collection and manual selection.

The long-term identity is the Zotero item or attachment, not the transient tab id. Reader tab id remains a runtime signal only.

### Thread Ownership

Add `scopeKey?: string` to `Thread`. New threads store the current scope key. Legacy stored threads derive it from `scopeSnapshot`.

Thread listing gains:

- `listThreadsForScope(scope, options?)`
- `findMostRecentThreadForScope(scope)`

The default `listThreads()` remains global for export and fallback paths.

### Session Behavior

`chatSessionStore.syncScope(scope)` stops mutating the active thread. If the active thread belongs to another scope, it clears the active thread and lets the current scope choose its own thread.

`send(message, scope)` reuses the active thread only when it belongs to the same scope. Otherwise it creates or restores the current scope's thread.

The old `recordScopeTransition()` path remains available only for legacy exports or future explicit cross-document workflows, not automatic tab switching.

### Sidebar Behavior

The sidebar loads current-scope recent threads when `scope` changes. It falls back to global recent threads only when the current scope has no stored thread.

Reader handoff uses `resolveSidebarLocation(selectedType)` instead of strict `selectedType === location`.

### Blank Sidebar Fallback

Wrap the sidebar tree in an error boundary. Render failures show a compact error panel inside the mounted section, making blank pane reports actionable.

## Files Expected To Change

- `docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md`
- `docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md`
- `docs/zotero-doc-index.md`
- `src/types/scope.ts`
- `src/types/thread.ts`
- `src/services/scopeResolver.ts`
- `src/services/threadController.ts`
- `src/services/chatSession.ts`
- `src/services/persistence.ts`
- `src/ui/sidebarSection.ts`
- `src/ui/components/Sidebar.tsx`
- focused tests beside those modules

## Acceptance Criteria

- Reader-like tab types are matched to the Reader sidebar surface.
- A React render failure in the sidebar displays a visible fallback message instead of a blank pane.
- New paper/PDF scopes include stable `scopeKey` values.
- New threads persist `scopeKey`; legacy threads get a derived `scopeKey` from `scopeSnapshot`.
- Current-scope recent threads are listed before global recent history.
- Switching scope does not append `Context switched to:` to a thread from another paper/PDF.
- Sending in PDF B cannot append to PDF A's active thread.
- Focused tests pass.
- `npm run build:dev:xpi` succeeds before real Zotero smoke.

## Verification Plan

Focused tests:

```bash
npm test -- src/ui/sidebarSection.test.ts src/ui/components/SidebarSource.test.ts
npm test -- src/services/scopeResolver.test.ts src/services/persistence.test.ts src/services/chatSession.test.ts
npm test -- src/services/threadController.test.ts src/ui/components/sidebarViewModel.test.ts
```

Broader gate:

```bash
npm test
npm run build:dev:xpi
```

## Real Zotero Smoke

Required before calling the host change release-ready:

1. Build and install the dev XPI through Zotero Add-ons.
2. Open at least three PDF Reader tabs.
3. Confirm the native right-pane `Deepseek Copliot` body is visible in each active Reader tab.
4. Send one message in PDF A.
5. Switch to PDF B and confirm PDF A's active thread is not shown as current.
6. Send or prefill from `Ask...` in PDF B.
7. Switch back to PDF A and confirm PDF A's history is available again.
8. Restart Zotero and repeat Reader host plus two-tab switch.

Evidence:

- XPI path and manifest version.
- `Zotero_Tabs.selectedType` and `selectedID` for each active tab.
- reader mount count, parent, display, and dimensions.
- screenshot or debug log showing scope id/key changes without thread mixing.

## Reference Adoption

Reference files inspected:

- `reference/beaver-zotero/react/hooks/useReaderSelectionActionHandler.ts`
- `reference/beaver-zotero/react/hooks/useReaderTabSelection.ts`
- `reference/beaver-zotero/react/components/RecentChats.tsx`

Borrow:

- Reader action should bind to the current Reader attachment before sending or focusing the composer.
- Recent conversations should prefer the current Reader attachment or its parent item before global history.
- Reader tab changes need explicit stale-state cleanup.

Do not borrow:

- Beaver account/authentication, subscriptions, Supabase, cloud threads, websocket protocol, or remote item-thread search service.
- Beaver UI styling or toolbar-only discovery.

Local verification:

- Vitest for scope keys, session isolation, current-scope recent threads, and Reader tab type matching.
- Packaged XPI smoke for actual Zotero host behavior.

## Risks And Mitigations

- Risk: legacy histories disappear from the current-scope recent list.
  Mitigation: derive `scopeKey` from `scopeSnapshot` during load and save migrated rows.
- Risk: clearing active thread on scope change feels like data loss.
  Mitigation: keep global recent fallback and expose recent current-scope threads immediately.
- Risk: Reader blank pane is caused by Zotero host visibility rather than React errors.
  Mitigation: add visible error fallback and keep runtime evidence for mount size/parent/display in smoke.
- Risk: new scope key shape is too narrow for collections.
  Mitigation: only use strict document-scoped behavior for `paper` and `pdf`; keep collections/manual selections as unsupported or fallback scope ids.

## Open Questions

- Should Library selecting a parent paper and Reader opening its PDF share one conversation pool, or should parent paper and PDF attachment remain separate? This spec keeps them separate because the user's screenshots and concern are PDF-reader centered.
- Should a future UI add an explicit `All recent chats` view when current-scope history is empty? This task keeps the current recent button and only changes ordering/filtering.
