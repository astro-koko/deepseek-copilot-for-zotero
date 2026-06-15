# Zotero AI Assistant Implementation Plan

## Current Execution Focus: 2026-05-31

The repository is currently executing against a narrower, more urgent target than the broader roadmap below.

Current priority:

- stabilize the Zotero frontend host surfaces first
- make `Deepseek Copliot` reliably usable in Add-ons, Settings, Library, Reader, and Reader handoff flows
- treat packaged `.xpi` plus full Zotero restart as the meaningful acceptance gate

Current execution documents:

- [Host-First Frontend Stabilization Design](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [Host-First Frontend Task Board](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [Zotero Dev Workbench](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [Zotero Dev Smoke Checklist](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

Interpret the rest of this file as the broader product roadmap, not as the immediate execution gate.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build a Zotero-native AI reading assistant that works in both library and reader surfaces, supports single-paper and collection-scoped Q&A, and replaces the “upload PDF to external chat” workflow.

**Architecture:** Reuse Beaver's Zotero panel integration, React shell, and local Zotero data access, but replace the cloud agent path with a local request pipeline: `surface state -> scope resolution -> thread controller -> provider -> response renderer`. Phase 1 keeps the product narrowly focused on reading assistance and lightweight slash presets instead of a general-purpose skill or MCP platform.

**Tech Stack:** Zotero 7 plugin, TypeScript, React, Jotai, existing Beaver reference code, OpenAI-compatible HTTP provider, local persistence through Zotero/plugin storage.

---

## 1. What This Plan Builds

This version of the plan is intentionally narrower than the previous draft.

It builds:

- one right-side AI panel in both library and reader views
- one conversation system with explicit context scope
- four context scopes: `pdf`, `paper`, `collection`, `manual-selection`
- automatic context selection based on current Zotero surface and selection
- lightweight `/` presets for common reading tasks
- local thread persistence and settings
- OpenAI-compatible provider support with user-supplied endpoint, key, and model

It does not build in Phase 1:

- MCP client support
- user-programmable skills
- vector search / embeddings
- cloud sync, auth, or remote thread state
- broad “agent platform” behavior

The main success condition is simple: a user can stay inside Zotero, ask questions about the current paper or current collection, and get useful answers without leaving the reading flow.

## 2. Product Decisions Locked For Implementation

These decisions are treated as fixed unless the spec changes:

- The product is a `reading-first Zotero assistant`, not a general agent host.
- `Reader view` defaults to `pdf` scope.
- `Library view` defaults to:
  - `paper` when one regular item is selected
  - `collection` when a collection/folder is selected
  - `manual-selection` when multiple supported items are selected
- Scope must always be visible in the panel header as chips or a compact scope bar.
- Scope changes inside an existing thread are allowed, but the UI must explicitly announce the change.
- Slash presets are `prompt presets`, not executable skills.
- The first implementation should reuse Beaver’s integration surfaces and local data code wherever possible, but not inherit its cloud product assumptions.

## 3. Delivery Strategy

The work should be executed in six implementation stages. Each stage must leave the plugin in a working state, even if the feature set is incomplete.

### Stage 0: Reference Audit And Project Skeleton

**Outcome**

Establish the exact parts of Beaver to reuse, the exact parts to ignore, and the file map for this project so implementation starts from a stable local architecture instead of a conceptual fork.

**Primary outputs**

- a local source tree scaffold for the new plugin codebase
- a documented reuse map from `reference/beaver-zotero`
- a short “phase-1 exclusions” note in the repo docs

**Engineering tasks**

1. Create the initial project source layout by mirroring only the Beaver areas needed for:
   - plugin bootstrap / hooks
   - UI registration
   - React app shell
   - local Zotero data access
2. Exclude or stub all cloud-specific subsystems:
   - account/auth
   - Supabase
   - sync
   - remote agent service
   - embeddings/indexing
3. Create a small architecture note in `docs/` that maps:
   - `reuse as-is`
   - `reuse with modification`
   - `do not import into phase 1`
4. Confirm the plugin still boots and the sidebar can mount with placeholder content.

**Acceptance criteria**

- The plugin builds.
- The panel mounts in library view.
- The panel mounts in reader view.
- No cloud credentials or remote service boot code is required for startup.

## 4. Stage 1: App Shell And Scope Model

**Outcome**

Introduce the product’s real center of gravity: a scope-aware panel shell that always knows what the assistant is currently looking at.

**Core implementation**

- Define a `ScopeType` model with:
  - `pdf`
  - `paper`
  - `collection`
  - `manual-selection`
- Define a normalized `ScopeContext` object that includes:
  - `type`
  - `id` or stable identifiers
  - `label`
  - included item ids
  - current reader attachment id when relevant
  - selected text snippet when relevant
- Implement a `ScopeResolver` service that translates Zotero UI state into the active scope.
- Implement a panel header scope display showing:
  - current scope label
  - number of items included when multi-item
  - whether selected text is attached

**Behavior rules**

- Reader view with an opened attachment resolves to `pdf`.
- Library view with one item resolves to `paper`.
- Library view with collection selected resolves to `collection`.
- Library view with multiple supported items resolves to `manual-selection`.
- If no valid scope can be derived, the panel must show an explicit empty state rather than guessing.

**Acceptance criteria**

- Switching among item / collection / reader surfaces updates the visible scope.
- The panel never silently answers against an invisible scope.
- Empty-state messaging is clear when no usable scope exists.

## 5. Stage 2: Local Thread Controller And Persistence

**Outcome**

Replace the old cloud run model with a local conversation controller that understands threads, scope transitions, and persisted history.

**Core implementation**

- Create a `ThreadController` or similarly named service responsible for:
  - creating threads
  - appending user/assistant messages
  - storing thread metadata
  - recording current or last-used scope
  - surfacing scope transition system messages
- Persist threads locally.
- Store at minimum:
  - thread id
  - title
  - created / updated timestamps
  - last scope snapshot
  - messages
- Add “new thread” and recent thread list support, but keep the UX lightweight.

**Required UX rules**

- A thread may continue across library and reader surfaces.
- If scope changes from one paper/collection to another, insert a visible assistant/system event like:
  - `Context switched to: <label>`
- If the scope change is large, the UI may suggest starting a new thread, but must not force it in Phase 1.

**Acceptance criteria**

- Restarting Zotero preserves past threads.
- Reopening a thread restores its messages and last known scope metadata.
- Scope changes are visible inside the thread history.

## 6. Stage 3: Provider Layer And Streaming Chat

**Outcome**

Add a minimal but production-shaped model provider layer so the plugin can stream answers from plugin-configured DeepSeek settings.

**Core implementation**

- Build a provider abstraction around:
  - `apiKey`
  - `model`
  - optional model capability flags
- Start with one generic OpenAI-compatible implementation.
- Support streaming text responses.
- Keep reasoning / special vendor fields out of the critical path for the first pass unless they fall out naturally from the chosen provider shape.

**Request construction**

Each model call should be assembled from:

- system instructions for the reading assistant
- active scope summary
- selected text, if present
- recent thread history
- user message

**First-pass system behavior**

The assistant should know:

- it is operating inside Zotero
- what scope it currently has
- that it must not pretend to have access beyond that scope
- that collection answers should synthesize only across the included items

**Acceptance criteria**

- A user can configure endpoint, key, and model in settings.
- Sending a question from either surface produces a streamed answer.
- Provider errors show actionable UI states, not silent failures.

## 7. Stage 4: Context Assembly For Paper And Collection Q&A

**Outcome**

Make answers grounded enough to be useful by building a deterministic context assembly path for both single-item and multi-item use.

**Core implementation**

- Introduce a `ContextAssembler` that gathers:
  - item metadata
  - attachment metadata
  - selected text
  - extracted PDF text or page slices
  - collection item summaries for multi-item scope
- Keep this deterministic and inspectable.
- Prefer explicit truncation and summarization rules over hidden retrieval logic.

**Recommended phase-1 context rules**

- `pdf` scope:
  - current attachment metadata
  - current paper metadata
  - selected text if any
  - PDF text excerpt or document text
- `paper` scope:
  - paper metadata
  - linked attachment text if available
- `collection` scope:
  - item list and lightweight metadata for all included items
  - capped full-text inclusion for a limited subset
  - if too large, reduce to structured summaries instead of naïvely concatenating everything
- `manual-selection` scope:
  - same strategy as collection, but only for chosen items

**Important constraint**

Collection scope must not quietly degrade into “entire library” behavior. The assistant should answer from the explicit included set only.

**Acceptance criteria**

- Single-paper answers clearly use the current paper.
- Collection answers mention multiple included papers when appropriate.
- Large collections degrade gracefully with explicit truncation/summarization rather than crashes or nonsense.

## 8. Stage 5: Slash Presets Instead Of Skills

**Outcome**

Expose a small set of high-value reading actions without building a full skill system.

**Core implementation**

- Build slash preset support in the composer.
- Presets should only affect:
  - instruction prefix / system prompt augmentation
  - output format hints
  - preferred scope intent where relevant
- Do not add executable tool registration or runtime plugin loading.

**Initial preset set**

Keep the first set small and tied to reading workflows:

- `/summarize`
- `/explain`
- `/method`
- `/limitations`
- `/compare`
- `/related-work`

**Preset behavior rules**

- `/compare` should warn or guide the user when current scope is only one paper.
- `/explain` should work especially well with selected text.
- `/summarize` should default to concise paper-level output.

**Acceptance criteria**

- Typing `/` opens a preset chooser.
- Picking a preset updates the message intent without changing the overall thread model.
- Presets are visible enough that users discover them, but do not dominate the UI.

## 9. Stage 6: Settings, Validation, And Hardening

**Outcome**

Finish the MVP with the settings surface, guardrails, and enough error handling to make the plugin usable outside a developer environment.

**Core implementation**

- Add settings UI for:
  - API key
  - base URL
  - model
  - optional max context budget
- Add connection / configuration validation where feasible.
- Add user-facing error states for:
  - missing API key
  - invalid endpoint
  - timeout
  - empty scope
  - no readable attachment text
- Add lightweight telemetry/logging hooks only if they stay local and help debug.

**UX requirements**

- The empty state should teach the user how scope works.
- The error state should help the user recover in one step.
- The panel should remain responsive while streaming or when a request fails.

**Acceptance criteria**

- A new user can install, configure, and ask a question without reading source code.
- Common configuration errors are recoverable through the settings panel.
- The MVP is stable enough for repeated daily use.

## 10. Suggested Module Boundaries

This is the recommended file-level decomposition for implementation. The exact paths can adjust to the repo’s eventual scaffold, but the boundaries should remain.

- `src/services/scopeResolver.ts`
  Maps Zotero UI state to normalized scope state.

- `src/services/threadController.ts`
  Owns thread lifecycle, persistence, and scope transition events.

- `src/services/provider/openAICompatibleProvider.ts`
  Handles HTTP request/response and streaming for the configured model backend.

- `src/services/contextAssembler.ts`
  Builds model-ready context from scope + Zotero data.

- `src/services/presets.ts`
  Defines slash preset metadata and prompt augmentation rules.

- `src/services/settingsManager.ts`
  Reads/writes plugin preferences.

- `src/ui/` and `react/components/`
  Reuse Beaver’s panel shell where possible, but keep new logic thin at the component layer.

Do not introduce in Phase 1:

- `skillRegistry.ts`
- `mcpClientManager.ts`
- generic `toolEngine.ts` unless a minimal internal-only abstraction is truly needed
- any system whose main purpose is future extensibility instead of current reading workflows

## 11. Reference Reuse Map

Use the reference folders deliberately instead of treating them as code to wholesale copy.

**High-value Beaver references**

- `reference/beaver-zotero/src/ui/`
  Sidebar mounting and native integration shape.
- `reference/beaver-zotero/src/modules/readerIntegration.ts`
  Reader-side entry behavior.
- `reference/beaver-zotero/src/services/agentDataProvider/`
  Local Zotero data access patterns worth reusing selectively.
- `reference/beaver-zotero/react/components/agentRuns/`
  Response rendering ideas, especially for streaming and structured parts.

**Use cautiously**

- `reference/beaver-zotero/src/services/OpenAIProvider.ts`
  Good transport reference, but do not inherit cloud assumptions by accident.

**Do not pull into phase 1 core**

- account/auth/sync services
- embeddings/indexing/search infrastructure
- MCP-first workflows
- monetization/account UI

## 12. Test Plan

Testing should be organized by behavior, not by implementation layer alone.

**Unit tests**

- `ScopeResolver`
  - reader attachment -> `pdf`
  - single item -> `paper`
  - collection selected -> `collection`
  - multiple items -> `manual-selection`
  - invalid/empty surface -> no scope
- `ThreadController`
  - create thread
  - append messages
  - persist/reload
  - insert scope transition event
- `ContextAssembler`
  - assembles expected metadata for paper scope
  - caps collection context correctly
  - preserves selected text
- `presets`
  - slash command lookup
  - prompt augmentation
  - `/compare` scope guidance

**Integration tests**

- library panel question on one item
- reader panel question on current PDF
- collection-scoped question over multiple papers
- thread persists after restart
- settings change updates provider behavior

**Manual acceptance scenarios**

1. Open a PDF in reader view, ask “Summarize this paper,” and confirm the visible scope is that PDF/paper.
2. Select a collection in library view, ask “What are the main differences across these papers?”, and confirm the answer uses multiple included items.
3. Start in one paper thread, switch to another paper, continue the conversation, and confirm a visible scope-switch event appears.
4. Remove API key and confirm the plugin shows a clear recovery path.

## 13. Execution Order Recommendation

Implement in this order:

1. Stage 0: project skeleton and mountable shell
2. Stage 1: scope model
3. Stage 2: local thread controller
4. Stage 3: provider and streaming
5. Stage 4: context assembly
6. Stage 5: slash presets
7. Stage 6: settings and hardening

This order matters because it ensures the core user experience is validated before optional polish. In particular, do not start with presets or generic abstraction work before scope-aware conversation is functioning end-to-end.

## 14. Risks And Mitigations

- `Over-inheriting Beaver complexity`
  Mitigation: explicitly exclude cloud, embedding, and account systems from the first pass.

- `Collection scope becoming too large`
  Mitigation: use capped item inclusion and explicit summarization/truncation rules.

- `Thread/scope confusion`
  Mitigation: always show scope in header and insert scope transition messages in-thread.

- `Weak PDF extraction quality`
  Mitigation: start with available attachment text paths and only deepen extraction complexity when grounded failures appear.

- `Provider compatibility drift`
  Mitigation: isolate provider behavior behind a small interface and test against one known-good OpenAI-compatible backend first.

## 15. Definition Of Done For MVP

The Phase 1 MVP is done when all of the following are true:

- the panel works in both library and reader views
- the assistant can answer with `paper`, `pdf`, `collection`, and `manual-selection` scopes
- scope is visible and changes are explicit
- users can configure an OpenAI-compatible endpoint and model
- threads persist locally
- slash presets work for the initial reading-focused set
- there is no dependency on cloud auth, remote sync, MCP, or vector search

At that point, the product will be strong enough to validate the core thesis before any broader platform work begins.
