# DS Copilot Host-First Frontend Task Board

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize DS Copilot's Zotero frontend surfaces so the plugin is visibly usable in Settings, Library, Reader, and Reader handoff flows before provider and release work expands.

**Architecture:** Keep the current repository as the implementation base, but reorganize the host-facing frontend around Beaver-style lifecycle boundaries. Preserve the existing service layer where possible while making host ownership deterministic per window and per surface.

**Tech Stack:** Zotero plugin scaffold, TypeScript, React 18, Vitest, Zotero XUL host APIs, Beaver reference implementation.

---

## Current Status

- Active branch: `codex/deepseek-official-config`
- Management baseline checkpoint committed at `76598f1` (`docs: add host-first frontend execution baseline`)
- Current repo state already includes:
  - Settings pane registration and hydration
  - Library/Reader native host logic plus fallback section
  - Reader selection popup/context-menu dispatch
  - host lifecycle tests for UI mounting and teardown
- Current project risk is not lack of code; it is unstable host ownership and incomplete frontend acceptance discipline
- Current branch state is mixed:
  - the committed baseline now records the host-first execution route
  - an additional unstaged implementation tranche is still in progress across `M1` through `M4`
  - no frontend milestone beyond `M0` should be treated as complete until packaged smoke proves it

## Live Worktree Snapshot

The current dirty worktree mostly maps to the frontend tranche, not random spillover.

### `M1` Settings in progress

- `addon/content/preferences.xhtml`
- `addon/prefs.js`
- `src/modules/preferencesPane.ts`
- `src/modules/preferencesPane.test.ts`
- `src/hooks.ts`

### `M2` / `M3` Native host ownership in progress

- `src/ui/ui.ts`
- `src/ui/ui.test.ts`
- `src/ui/sidebarSection.ts`
- `src/ui/sidebarSection.test.ts`
- `src/ui/sidebarRuntime.ts`
- `src/ui/sidebarRuntime.test.ts`
- `src/ui/toggleChat.ts`

### `M4` Reader handoff and shell interaction in progress

- `src/ui/components/Sidebar.tsx`
- `src/ui/components/sidebarViewModel.ts`
- `src/ui/components/sidebarViewModel.test.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/readerActionFlow.test.ts`

### Supporting test and typing churn present

- `src/services/chatSession.test.ts`
- `src/services/provider/openAICompatibleProvider.test.ts`
- `typings/i10n.d.ts`
- `typings/prefs.d.ts`

## Source-Of-Truth File Map

- `src/hooks.ts`
  startup, main-window load/unload, prefs registration, shutdown
- `src/modules/preferencesPane.ts`
  Settings pane hydration, persistence, idempotent event binding
- `src/ui/ui.ts`
  toolbar integration, native host attach/detach, reload cleanup, visibility truth
- `src/ui/sidebarSection.ts`
  host creation, fallback section logic, native pane helpers, sibling visibility
- `src/ui/sidebarRuntime.ts`
  persisted sidebar visibility state and refresh broadcast
- `src/modules/readerIntegration.ts`
  Reader popup and context menu actions
- `src/ui/readerActionFlow.ts`
  generated drafts and scope merge rules for Reader actions
- `src/ui/components/Sidebar.tsx`
  interactive shell used by Library and Reader surfaces
- `src/ui/ui.test.ts`
  high-level host lifecycle verification
- `src/ui/sidebarSection.test.ts`
  lower-level mount and fallback host verification
- `src/modules/preferencesPane.test.ts`
  Settings pane behavior verification
- `docs/zotero-dev-workbench.md`
  repo workflow
- `docs/zotero-dev-smoke-checklist.md`
  acceptance checklist

## Milestones

- [x] `M0` Repo already has a mountable DS Copilot host implementation
- [ ] `M1` Settings pane is stable and persistent in the daily profile
- [ ] `M2` Library native host owns the right pane without false-visible states
- [ ] `M3` Reader native host survives tab/layout/reload churn
- [ ] `M4` Reader `Explain` / `Ask...` handoff reaches an interactive sidebar flow
- [ ] `M5` Packaged `.xpi` passes frontend smoke after full restart
- [ ] `M6` Restored plugin set passes compatibility regression

## Workstream A: Lifecycle And Host Ownership

**Files:**
- Modify: `src/hooks.ts`
- Modify: `src/ui/ui.ts`
- Modify: `src/ui/sidebarSection.ts`
- Modify: `src/utils/windowLifecycle.ts`
- Test: `src/ui/ui.test.ts`
- Test: `src/ui/sidebarSection.test.ts`

- [ ] Separate window-level registration from surface-level mount ownership.
- [ ] Guarantee one host and one React root per window per surface.
- [ ] Remove stale mounts before attaching a fresh host on reload.
- [ ] Make Library open/close explicitly hide and restore native pane siblings.
- [ ] Make Reader reparenting stable between inner and outer context panes.
- [ ] Extend tests for stale mount cleanup, duplicate prevention, and shutdown teardown.

## Workstream B: Settings Pane Reliability

**Files:**
- Modify: `src/hooks.ts`
- Modify: `src/modules/preferencesPane.ts`
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/prefs.js`
- Test: `src/modules/preferencesPane.test.ts`

- [ ] Make `onPrefsEvent("load")` safe to call repeatedly without double-binding.
- [ ] Verify `apiKey`, `model`, and `maxContextBudget` round-trip between UI and prefs.
- [ ] Ensure the pane never renders blank due to missing initialization order.
- [ ] Keep the pane intentionally narrow: only fields needed for the first usable frontend.
- [ ] Add or refine tests for hydration, save, reopen, and persistence behavior.

## Workstream C: Reader Handoff And Interactive Shell

**Files:**
- Modify: `src/modules/readerIntegration.ts`
- Modify: `src/ui/readerActionFlow.ts`
- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/components/sidebarViewModel.ts`
- Test: `src/ui/readerActionFlow.test.ts`
- Test: `src/ui/ui.test.ts`

- [ ] Keep Beaver-style Reader event registration and cleanup discipline.
- [ ] Ensure `Explain` auto-submits a draft after the sidebar is visible.
- [ ] Ensure `Ask...` pre-fills without sending.
- [ ] Confirm Reader-selected text merges into active scope without clobbering surface state.
- [ ] Verify the shell remains interactive after handoff, not just visually mounted.

## Workstream D: Acceptance Discipline And Compatibility

**Files:**
- Modify: `docs/zotero-dev-workbench.md`
- Modify: `docs/zotero-dev-smoke-checklist.md`
- Modify: `docs/zotero-sidebar-stability-review.md`
- Modify: `IMPLEMENTATION_PLAN.md`

- [x] Treat the daily Zotero profile as the formal frontend acceptance environment.
- [x] Record the fixed runtime evidence collected during host debugging.
- [x] Split smoke into:
  - stage 1 minimal-isolation frontend host pass
  - stage 2 restored-plugin compatibility pass
- [x] Keep `.xpi` restart verification as the gate for claiming the frontend usable.

## Current Acceptance Gates

### Stage 1: Minimal-Isolation Frontend Gate

- [ ] Add-ons entry visible after packaged install
- [ ] Settings pane visible, editable, persistent
- [ ] Library native host visibly stable
- [ ] Reader native host visibly stable
- [ ] `Explain` auto-send handoff works
- [ ] `Ask...` prefill-only handoff works
- [ ] full Zotero restart preserves the same behavior

### Stage 2: Compatibility Regression Gate

- [ ] Restore the normal plugin set
- [ ] Repeat Settings, Library, Reader, and restart checks
- [ ] Confirm no duplicate mounts, no blank pane, and no selected-button / hidden-pane mismatch

## Git Hygiene For This Phase

- [ ] Keep host-front-end work isolated from provider experiments whenever possible
- [ ] Prefer workstream-sized commits instead of giant mixed commits
- [ ] Update this board when a milestone turns green or a blocker changes
- [ ] Do not call the branch release-ready until `M5` and `M6` are both complete

## Recommended Next Git Slices

The safest next commit sequence from the current worktree is:

1. `M1 + M2 core host checkpoint`
   - Settings pane persistence/idempotence
   - native host ownership and visibility control
   - related tests only
2. `M3 + M4 interaction checkpoint`
   - Reader host churn fixes
   - Reader `Explain` / `Ask...` handoff
   - shell/view-model interaction fixes
3. `test-and-typing cleanup checkpoint`
   - supporting tests and type updates that remain after the first two slices

Before each commit:

- verify the staged file list matches the intended milestone slice
- avoid staging unrelated repository cleanup or reference-material churn
- update this board if a milestone actually turns green

## Exact Staging Groups

Use these groups as the default file boundaries unless the implementation itself changes shape.

### Slice A: `M1 + M2 core host checkpoint`

Primary purpose:

- Settings pane persistence and idempotence
- Library/native host ownership and visibility truth

Preferred staged files:

- `addon/content/preferences.xhtml`
- `addon/prefs.js`
- `addon/locale/en-US/preferences.ftl`
- `src/hooks.ts`
- `src/modules/preferencesPane.ts`
- `src/modules/preferencesPane.test.ts`
- `src/ui/ui.ts`
- `src/ui/ui.test.ts`
- `src/ui/sidebarSection.ts`
- `src/ui/sidebarSection.test.ts`
- `src/ui/sidebarRuntime.ts`
- `src/ui/sidebarRuntime.test.ts`
- `src/ui/toggleChat.ts`
- `typings/i10n.d.ts`
- `typings/prefs.d.ts`

Preferred focused verification:

```bash
npx vitest run \
  src/modules/preferencesPane.test.ts \
  src/ui/ui.test.ts \
  src/ui/sidebarSection.test.ts \
  src/ui/sidebarRuntime.test.ts
```

Pre-commit check:

```bash
git add addon/content/preferences.xhtml addon/prefs.js addon/locale/en-US/preferences.ftl \
  src/hooks.ts src/modules/preferencesPane.ts src/modules/preferencesPane.test.ts \
  src/ui/ui.ts src/ui/ui.test.ts src/ui/sidebarSection.ts src/ui/sidebarSection.test.ts \
  src/ui/sidebarRuntime.ts src/ui/sidebarRuntime.test.ts src/ui/toggleChat.ts \
  typings/i10n.d.ts typings/prefs.d.ts
git diff --cached --name-only
```

### Slice B: `M3 + M4 interaction checkpoint`

Primary purpose:

- Reader host churn fixes
- `Explain` / `Ask...` handoff
- shell and view-model interaction behavior

Preferred staged files:

- `src/ui/components/Sidebar.tsx`
- `src/ui/components/sidebarViewModel.ts`
- `src/ui/components/sidebarViewModel.test.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/readerActionFlow.test.ts`
- `src/services/chatSession.test.ts`
- `src/services/provider/openAICompatibleProvider.test.ts`

Preferred focused verification:

```bash
npx vitest run \
  src/ui/readerActionFlow.test.ts \
  src/ui/components/sidebarViewModel.test.ts \
  src/services/chatSession.test.ts \
  src/services/provider/openAICompatibleProvider.test.ts
```

Pre-commit check:

```bash
git add src/ui/components/Sidebar.tsx src/ui/components/sidebarViewModel.ts \
  src/ui/components/sidebarViewModel.test.ts src/ui/readerActionFlow.ts \
  src/ui/readerActionFlow.test.ts src/services/chatSession.test.ts \
  src/services/provider/openAICompatibleProvider.test.ts
git diff --cached --name-only
```

### Slice C: `roadmap-doc drift cleanup`

Primary purpose:

- clean up remaining older-board wording that no longer reflects the host-first baseline

Preferred staged files:

- `docs/superpowers/plans/2026-05-30-zotero-ai-assistant-task-board.md`

Preferred verification:

- manual review only

## History Caveat

The branch history now contains two useful management checkpoints:

- `76598f1` introduced the host-first execution baseline
- `01da25b` recorded the live frontend tranche state

However, `76598f1` is not a pure docs-only checkpoint because earlier staged code was swept into that commit. Do not use commit-message wording alone as evidence of scope. When preparing the next implementation checkpoint, trust the live file list and focused verification commands above.
