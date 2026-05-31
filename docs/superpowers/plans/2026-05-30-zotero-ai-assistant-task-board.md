# Zotero AI Assistant Task Board

## Status: historical roadmap board

This board is still useful for the broader product roadmap, but it is no longer the active execution board for the current frontend stabilization push.

Use these files first for the current execution path:

- [2026-05-31-ds-copilot-host-first-frontend-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [2026-05-31-ds-copilot-host-first-frontend-task-board.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

Current interpretation:

- host-first frontend stabilization is the immediate goal
- packaged `.xpi` plus restart is the real acceptance gate
- this older board should not be used as the top-level source of truth for current sequencing

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this board task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved spec and implementation plan into a start-ready execution board for a Phase 1 Zotero-native AI reading assistant.

**Architecture:** Reuse Beaver for plugin bootstrap, React shell, and reader/library integration patterns, while borrowing AIdea's native context-panel lifecycle where it is simpler and more directly aligned with Zotero side panels. Replace all cloud-first behavior with a local pipeline: `surface state -> scope resolver -> thread controller -> context assembler -> provider -> streamed response renderer`.

**Tech Stack:** Zotero 7 plugin, TypeScript, React, Jotai, `zotero-plugin-toolkit`, OpenAI-compatible HTTP API, local Zotero/plugin persistence.

---

## Working Notes

- This board is derived from [IMPLEMENTATION_PLAN.md](/Users/Liang/project/agentpaper_zotero/IMPLEMENTATION_PLAN.md) and [2026-05-30-zotero-ai-assistant-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-30-zotero-ai-assistant-design.md).
- The current repository does not yet contain a real plugin source tree, so Stage 0 starts with scaffold and reuse-boundary work.
- Treat Beaver as the primary product/UI reference and AIdea as the primary native side-panel lifecycle reference.
- Do not import cloud auth, sync, embeddings, MCP, billing, or agent-platform subsystems into Phase 1.

## Target File Map

- `package.json`
  Project config, build scripts, addon identity.
- `src/addon.ts`
  Addon instance container and shared runtime handles.
- `src/hooks.ts`
  Startup, shutdown, main-window registration, prefs pane registration.
- `src/modules/panel/index.ts`
  Item pane section registration and surface bootstrap entrypoint.
- `src/modules/panel/libraryPanel.ts`
  Library-mode host creation, empty-selection fallback, DOM reparenting.
- `src/modules/panel/readerPanel.ts`
  Reader-mode host creation, per-item DOM caching, bootstrap.
- `src/modules/readerIntegration.ts`
  Reader selection/context menu hooks.
- `src/services/scopeResolver.ts`
  Map Zotero UI state to `ScopeContext`.
- `src/services/zoteroContextBridge.ts`
  Read current item, collection, reader attachment, and selected text.
- `src/services/threadController.ts`
  Local thread lifecycle, persistence, and scope transition events.
- `src/services/contextAssembler.ts`
  Build model-ready context from scope plus Zotero data.
- `src/services/provider/openAICompatibleProvider.ts`
  Minimal provider abstraction and streaming transport.
- `src/services/settingsManager.ts`
  Read and write API settings and context budget settings.
- `src/services/presets.ts`
  Slash preset metadata and prompt augmentation rules.
- `react/index.tsx`
  React root registration and shared store bootstrap.
- `react/components/sidebar/*`
  Sidebar shell, header scope bar, thread view, composer, settings.
- `react/store/*`
  Jotai atoms for UI state, scope, threads, and settings.
- `tests/unit/*`
  Scope, thread, presets, provider, and context assembly tests.
- `tests/integration/*`
  Dual-surface mount, persistence, and streaming flow tests.

## Reference Reuse Rules

### Reuse As-Is or Nearly As-Is

- Beaver: [src/addon.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/addon.ts)
- Beaver: [react/index.tsx](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/react/index.tsx)
- AIdea: [src/modules/contextPanel/index.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/index.ts)
- AIdea: [src/modules/contextPanel/libraryPanel.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/libraryPanel.ts)
- AIdea: [src/modules/contextPanel/readerPanel.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/readerPanel.ts)

### Reuse With Modification

- Beaver: [src/hooks.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/hooks.ts)
- Beaver: [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/modules/readerIntegration.ts)
- Beaver: [src/services/OpenAIProvider.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/services/OpenAIProvider.ts)

### Do Not Import Into Phase 1 Core

- Beaver `accountService`, `syncService`, `supabaseClient`, `embeddingIndexer`, `semanticSearchService`, `mcpService`, `agentService`, `threadService`
- AIdea `oauthCli.ts` monolith and provider-specific web product emulation logic

## Milestone View

- `M0`: Plugin scaffold exists and placeholder panel mounts in library and reader views.
- `M1`: Scope-aware shell works across `pdf`, `paper`, `collection`, and `manual-selection`.
- `M2`: Local threads persist and record visible scope transitions.
- `M3`: Settings plus OpenAI-compatible streaming chat are usable end to end.
- `M4`: Paper and collection context assembly are grounded and bounded.
- `M5`: Slash presets, hardening, and test coverage make the MVP daily-usable.

## Stage 0: Reference Audit And Project Skeleton

### Task 0.1: Write The Reuse Matrix

**Outputs:** `docs/architecture/reuse-matrix.md` or equivalent note, Phase 1 exclusions note

**Dependencies:** none

**Acceptance:**
- Each imported reference area is labeled `reuse as-is`, `reuse with modification`, or `exclude`.
- Phase 1 exclusions match the implementation plan.

**References:**
- Beaver [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/ui/ui.ts)
- AIdea [src/modules/contextPanel/index.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/index.ts)

- [ ] List Beaver modules that define addon bootstrap, React mount points, reader integration, and local data access.
- [ ] List AIdea modules that define section registration, library fallback mounting, and reader host caching.
- [ ] Mark every cloud/service-heavy module as excluded from Phase 1.
- [ ] Save the reuse matrix and link it from repo docs.

### Task 0.2: Create The Plugin Scaffold

**Outputs:** initial `package.json`, `src/`, `react/`, `addon/`, `tests/` tree

**Dependencies:** Task 0.1

**Acceptance:**
- The repository has a valid Zotero plugin scaffold shape.
- Addon identity fields are set for the new plugin, not copied from Beaver or AIdea.

**References:**
- Beaver [package.json](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/package.json)
- AIdea [package.json](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/package.json)

- [ ] Create the base directory structure from the target file map in this board.
- [ ] Copy only the minimum build-script patterns needed for a Zotero 7 plugin plus React bundle.
- [ ] Define addon identity values: `addonName`, `addonID`, `addonRef`, `addonInstance`, `prefsPrefix`.
- [ ] Add a short repo note documenting that the scaffold is Beaver-inspired but cloud-free.

### Task 0.3: Bootstrap Addon Runtime

**Outputs:** `src/addon.ts`, `src/hooks.ts`, minimal prefs registration, startup/shutdown wiring

**Dependencies:** Task 0.2

**Acceptance:**
- The addon can start without cloud credentials or remote service boot code.
- Main-window load and unload hooks are present and safe.

**References:**
- Beaver [src/addon.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/addon.ts)
- Beaver [src/hooks.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/hooks.ts)
- AIdea [src/hooks.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/hooks.ts)

- [ ] Create the addon instance container with runtime handles for toolkit, settings, and optional services.
- [ ] Build a simplified `onStartup` that waits for Zotero readiness and registers windows.
- [ ] Build safe `onMainWindowLoad`, `onMainWindowUnload`, and `onShutdown` hooks.
- [ ] Register a minimal preferences surface or placeholder settings entrypoint.

### Task 0.4: Mount Placeholder Panels In Both Surfaces

**Outputs:** `src/modules/panel/index.ts`, `libraryPanel.ts`, `readerPanel.ts`, placeholder React shell

**Dependencies:** Task 0.3

**Acceptance:**
- The panel mounts in library view.
- The panel mounts in reader view.
- Empty library selection still shows a visible placeholder panel.

**References:**
- AIdea [src/modules/contextPanel/index.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/index.ts)
- AIdea [src/modules/contextPanel/libraryPanel.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/libraryPanel.ts)
- AIdea [src/modules/contextPanel/readerPanel.ts](/Users/Liang/project/agentpaper_zotero/reference/aidea-zotero/src/modules/contextPanel/readerPanel.ts)
- Beaver [react/index.tsx](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/react/index.tsx)

- [ ] Register one Zotero side-panel section for both library and reader surfaces.
- [ ] Implement shared host mounting for library mode, including the no-selection fallback case.
- [ ] Implement per-reader-item host caching to avoid remount churn on tab switches.
- [ ] Render a placeholder sidebar shell that proves the mount points work.

## Stage 1: App Shell And Scope Model

### Task 1.1: Define Core Domain Types

**Outputs:** scope, thread, provider, and preset type definitions

**Dependencies:** Task 0.4

**Acceptance:**
- `ScopeType` and `ScopeContext` are explicitly defined.
- Thread and provider contracts are stable enough for later services to depend on.

- [ ] Define `ScopeType` with `pdf`, `paper`, `collection`, and `manual-selection`.
- [ ] Define `ScopeContext` with stable identifiers, label, included item IDs, attachment ID, and selected text snapshot.
- [ ] Define thread message and thread summary types with room for system scope-transition events.
- [ ] Define provider request/stream/error contracts for the first OpenAI-compatible backend.

### Task 1.2: Implement The Zotero Context Bridge

**Outputs:** `src/services/zoteroContextBridge.ts`

**Dependencies:** Task 1.1

**Acceptance:**
- The service can read the current selected item, current collection, current PDF attachment, and selected text when available.
- No part of the bridge assumes cloud sync or external indexing.

**References:**
- Beaver [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/modules/readerIntegration.ts)
- AIdea context panel lifecycle files above

- [ ] Add helpers to read current library selection and collection context.
- [ ] Add helpers to resolve the active reader attachment.
- [ ] Add helpers to capture selected text when the reader surface provides it.
- [ ] Normalize all bridge output into one internal shape that `scopeResolver` can consume.

### Task 1.3: Implement The Scope Resolver

**Outputs:** `src/services/scopeResolver.ts`

**Dependencies:** Task 1.2

**Acceptance:**
- Reader resolves to `pdf`.
- Single item resolves to `paper`.
- Collection resolves to `collection`.
- Multi-item selection resolves to `manual-selection`.
- Invalid state yields an explicit empty scope.

- [ ] Encode the resolution rules from the implementation plan as deterministic branches.
- [ ] Add guardrails so unsupported or empty surfaces return a typed empty result.
- [ ] Include a visible reason string for empty states to improve UX later.
- [ ] Add a way to detect whether selected text is attached to the resolved scope.

### Task 1.4: Build The Scope-Aware Sidebar Shell

**Outputs:** header scope bar, empty state, placeholder thread area, composer shell

**Dependencies:** Task 1.3

**Acceptance:**
- The visible header always shows the current scope label.
- The panel never appears to answer against invisible context.
- No-scope states teach the user what to select or open.

**References:**
- Beaver `react/components/*` shell patterns

- [ ] Add a header area that displays scope type, label, item count, and selected-text badge.
- [ ] Add an empty-state component for no item, no collection, or no readable reader state.
- [ ] Add a placeholder thread area that will later host persisted messages.
- [ ] Add a composer shell that can be disabled when scope is invalid.

## Stage 2: Local Thread Controller And Persistence

### Task 2.1: Define Local Thread Storage Shape

**Outputs:** thread storage schema and persistence boundary

**Dependencies:** Task 1.4

**Acceptance:**
- Stored fields cover thread ID, title, timestamps, last scope snapshot, and message history.
- The storage boundary is local-only and does not borrow Beaver's cloud thread model.

- [ ] Decide whether persistence lives in Zotero/plugin storage, SQLite, or a lightweight local store wrapper.
- [ ] Define the persisted message shape for `user`, `assistant`, and `system` events.
- [ ] Define title-generation rules for new threads.
- [ ] Define a migration-friendly storage version marker.

### Task 2.2: Implement Thread Controller

**Outputs:** `src/services/threadController.ts`

**Dependencies:** Task 2.1

**Acceptance:**
- New threads can be created, loaded, updated, and listed.
- Scope change system messages are inserted when context moves between papers or collections.

- [ ] Implement `createThread`, `loadThread`, `appendMessage`, `listRecentThreads`, and `updateScopeSnapshot`.
- [ ] Insert `Context switched to: <label>` system events when the active scope changes materially.
- [ ] Keep the controller independent from React so it can be unit-tested cleanly.
- [ ] Expose minimal selectors for the sidebar shell to consume.

### Task 2.3: Connect Thread State To The UI

**Outputs:** thread list, new-thread action, restored message rendering

**Dependencies:** Task 2.2

**Acceptance:**
- Restarting Zotero preserves past threads.
- Reopening a thread restores visible messages and scope metadata.

**References:**
- Beaver thread list UI concepts, not thread service implementation

- [ ] Add a new-thread action in the sidebar shell.
- [ ] Add a lightweight recent-thread list instead of a large chat-management surface.
- [ ] Restore the active thread on mount using the local controller.
- [ ] Render system scope-transition messages distinct from user and assistant messages.

## Stage 3: Provider Layer And Streaming Chat

### Task 3.1: Build Settings Manager And Settings Surface

**Outputs:** `src/services/settingsManager.ts`, settings UI or pane

**Dependencies:** Task 2.3

**Acceptance:**
- Users can configure `apiKey`, `model`, and optional context budget inside the plugin Settings pane.
- Missing or invalid settings are shown as actionable UI states.

**References:**
- Beaver preferences components for structure only
- AIdea preference organization for field coverage only

- [ ] Create a local settings manager over Zotero prefs with a narrow key set.
- [ ] Add a simple settings UI reachable from the sidebar or prefs pane.
- [ ] Validate required fields before a request starts.
- [ ] Add a minimal connection-test action if feasible without overcomplicating Phase 1.

### Task 3.2: Implement The OpenAI-Compatible Provider

**Outputs:** `src/services/provider/openAICompatibleProvider.ts`

**Dependencies:** Task 3.1

**Acceptance:**
- Non-streaming and streaming requests both work against an OpenAI-compatible endpoint.
- Provider errors are normalized for the UI.

**References:**
- Beaver [src/services/OpenAIProvider.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/src/services/OpenAIProvider.ts)

- [ ] Extract the transport shape worth keeping from Beaver's provider.
- [ ] Remove assumptions about Beaver accounts, hosted defaults, or multi-vendor product rules.
- [ ] Implement request building around `model`, `messages`, and `stream`.
- [ ] Normalize timeout, auth, network, and invalid-endpoint failures into UI-friendly errors.

### Task 3.3: Build The Streaming Chat Orchestrator

**Outputs:** send-message action, streaming renderer, cancel/error states

**Dependencies:** Task 3.2

**Acceptance:**
- Sending a question from either surface produces a streamed reply.
- The panel remains responsive during streaming and after failures.

- [ ] Assemble requests from system instructions, active scope summary, selected text, recent history, and user message.
- [ ] Stream partial assistant tokens into the active thread.
- [ ] Add loading, cancel, and retry states in the composer and thread view.
- [ ] Keep failures visible and recoverable without losing the thread.

## Stage 4: Context Assembly For Paper And Collection Q&A

### Task 4.1: Build The PDF And Item Data Access Layer

**Outputs:** helpers for metadata, attachment lookup, and readable text extraction

**Dependencies:** Task 3.3

**Acceptance:**
- The plugin can gather item metadata and linked attachment text without cloud services.
- Failure to read attachment text becomes an explicit state, not a silent omission.

- [ ] Define how to fetch item metadata and linked attachment metadata from Zotero.
- [ ] Define how to extract or retrieve readable PDF text for the current attachment.
- [ ] Add error returns for unreadable or missing attachments.
- [ ] Bound all extraction work so it can later respect a context budget.

### Task 4.2: Implement Paper And PDF Context Assembly

**Outputs:** single-paper and reader-scope context assembly

**Dependencies:** Task 4.1

**Acceptance:**
- Single-paper answers clearly use the current paper.
- Reader scope can prioritize selected text and current attachment context.

- [ ] Build `pdf` scope assembly from paper metadata, attachment metadata, selected text, and PDF text excerpts.
- [ ] Build `paper` scope assembly from item metadata plus linked attachment text when available.
- [ ] Keep the assembly deterministic and inspectable.
- [ ] Add truncation rules that are explicit instead of hidden retrieval behavior.

### Task 4.3: Implement Collection And Manual-Selection Context Assembly

**Outputs:** multi-item context assembly with bounded degradation

**Dependencies:** Task 4.2

**Acceptance:**
- Collection answers draw only from the included set.
- Large collections degrade gracefully instead of acting like whole-library search.

- [ ] Build `collection` scope assembly from item list plus lightweight metadata for all included items.
- [ ] Add capped full-text inclusion for only a bounded subset of items.
- [ ] Build `manual-selection` assembly using the same strategy but only for chosen items.
- [ ] Add explicit truncation or summarization notices when the input set is too large.

### Task 4.4: Add Request Debug Visibility

**Outputs:** inspectable scope/context summary in the UI or logs

**Dependencies:** Task 4.3

**Acceptance:**
- Developers can tell what scope and context were sent.
- Users can see enough context labeling to trust the assistant's grounding.

- [ ] Add a compact UI summary of current scope and included item count.
- [ ] Add a developer-facing log or debug payload for assembled context size and source type.
- [ ] Make selected-text attachment visible when present.
- [ ] Keep debug visibility local-only and safe for normal users.

## Stage 5: Slash Presets Instead Of Skills

### Task 5.1: Define Preset Registry

**Outputs:** `src/services/presets.ts`

**Dependencies:** Task 4.4

**Acceptance:**
- Presets exist for `/summarize`, `/explain`, `/method`, `/limitations`, `/compare`, `/related-work`.
- Presets only change prompt intent and output hints.

- [ ] Define preset metadata with command, title, description, and prompt augmentation.
- [ ] Add optional scope guidance metadata for presets like `/compare`.
- [ ] Keep the registry declarative and local.
- [ ] Prevent presets from becoming executable tools or plugin extensions.

### Task 5.2: Build The Slash Chooser In The Composer

**Outputs:** slash menu and composer integration

**Dependencies:** Task 5.1

**Acceptance:**
- Typing `/` opens a preset chooser.
- Choosing a preset updates the outgoing intent without changing the thread model.

- [ ] Add slash detection to the composer.
- [ ] Render a lightweight preset chooser with keyboard support.
- [ ] Insert the chosen preset intent into the pending request state.
- [ ] Keep preset discovery visible but not dominant in the UI.

### Task 5.3: Add Preset-Specific Guidance Rules

**Outputs:** preset guardrails in the request builder and UI

**Dependencies:** Task 5.2

**Acceptance:**
- `/compare` warns when scope is only one paper.
- `/explain` works well with selected text.
- `/summarize` defaults to concise output.

- [ ] Add one-paper guidance for `/compare`.
- [ ] Bias `/explain` toward selected text when available.
- [ ] Bias `/summarize` toward concise paper-level output.
- [ ] Confirm presets remain compatible with manual freeform questions.

## Stage 6: Settings, Validation, And Hardening

### Task 6.1: Harden Empty, Error, And Loading States

**Outputs:** resilient UX states across startup, scope gaps, and provider failures

**Dependencies:** Task 5.3

**Acceptance:**
- Common configuration and scope errors are recoverable in one step.
- The panel stays responsive during long or failed requests.

- [ ] Add recoverable states for missing API key, invalid endpoint, timeout, empty scope, and unreadable attachment text.
- [ ] Make empty states explain how scope selection works.
- [ ] Make loading states clear but lightweight.
- [ ] Make retry and settings navigation obvious from error views.

### Task 6.2: Build The Test Matrix

**Outputs:** unit and integration test coverage for the MVP path

**Dependencies:** Task 6.1

**Acceptance:**
- Scope resolution, thread persistence, presets, provider errors, and context assembly are covered by tests.
- Dual-surface smoke tests exist for library and reader mounting.

- [ ] Add unit tests for `ScopeResolver`.
- [ ] Add unit tests for `ThreadController` persistence and scope-transition events.
- [ ] Add unit tests for `ContextAssembler` truncation and selected-text preservation.
- [ ] Add unit tests for preset lookup and prompt augmentation.
- [ ] Add integration tests for library mount, reader mount, persisted thread restore, and settings-driven provider changes.

### Task 6.3: Final Docs And Daily-Use Smoke Pass

**Outputs:** install/configure/use docs and manual smoke checklist

**Dependencies:** Task 6.2

**Acceptance:**
- A new user can install, configure, and ask a question without reading source code.
- The MVP is stable enough for repeated daily use.

- [ ] Write a short install and setup guide for endpoint, API key, and model configuration.
- [ ] Write a short usage guide for library scope, reader scope, and slash presets.
- [ ] Create a manual smoke checklist covering one paper, one PDF selection, one collection, one thread reload, and one provider failure case.
- [ ] Link the smoke checklist from repo docs so future work starts from the same baseline.

## Recommended First Sprint

- [ ] Complete Tasks `0.1` through `0.4`.
- [ ] Complete Tasks `1.1` through `1.4`.
- [ ] Stop after `M1` and verify that the shell, scope bar, and empty states behave correctly before starting persistence.

## Execution Handoff

Plan complete and saved as a dedicated task board. Recommended execution order is:

- `Sprint A`: Stages 0 and 1
- `Sprint B`: Stages 2 and 3
- `Sprint C`: Stages 4 through 6

Two execution options:

1. `Subagent-Driven (recommended)` - dispatch a fresh subagent per task, review between tasks, faster iteration with tighter checkpoints.
2. `Inline Execution` - execute the board in this session using one running implementation loop.
