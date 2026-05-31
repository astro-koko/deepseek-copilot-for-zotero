# DS Copilot Host-First Frontend Task Board

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize DS Copilot's Zotero frontend surfaces so the plugin is visibly usable in Settings, Library, Reader, and Reader handoff flows before provider and release work expands.

**Architecture:** Keep the current repository as the implementation base, but reorganize the host-facing frontend around Beaver-style lifecycle boundaries. Preserve the existing service layer where possible while making host ownership deterministic per window and per surface.

**Tech Stack:** Zotero plugin scaffold, TypeScript, React 18, Vitest, Zotero XUL host APIs, Beaver reference implementation.

---

## Current Status

- Active branch: `codex/deepseek-official-config`
- Current repo state already includes:
  - Settings pane registration and hydration
  - Library/Reader native host logic plus fallback section
  - Reader selection popup/context-menu dispatch
  - host lifecycle tests for UI mounting and teardown
- Current project risk is not lack of code; it is unstable host ownership and incomplete frontend acceptance discipline

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

- [ ] Treat the daily Zotero profile as the formal frontend acceptance environment.
- [ ] Record the fixed runtime evidence collected during host debugging.
- [ ] Split smoke into:
  - stage 1 minimal-isolation frontend host pass
  - stage 2 restored-plugin compatibility pass
- [ ] Keep `.xpi` restart verification as the gate for claiming the frontend usable.

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
