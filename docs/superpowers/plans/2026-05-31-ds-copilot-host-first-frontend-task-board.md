# Deepseek Copliot Host-First Frontend Task Board

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Deepseek Copliot's Zotero frontend surfaces so the plugin is visibly usable in Settings, Library, Reader, and Reader handoff flows before provider and release work expands.

**Architecture:** Keep the current repository as the implementation base, but reorganize the host-facing frontend around Beaver-style lifecycle boundaries. Preserve the existing service layer where possible while making host ownership deterministic per window and per surface.

**Tech Stack:** Zotero plugin scaffold, TypeScript, React 18, Vitest, Zotero XUL host APIs, Beaver reference implementation.

---

## Current Status

- Active branch: `codex/deepseek-official-config`
- Management baseline checkpoint committed at `76598f1` (`docs: add host-first frontend execution baseline`)
- Latest verified daily-profile facts:
  - `Settings` is no longer blank; the Deepseek Copliot preferences pane renders real fields and actions
  - the `Settings` pane now exposes a real secure `API Key` input, and the user-facing settings contract is being collapsed toward `API key` only
  - `Reader` scope resolution is now tied to the active PDF tab, so the native host no longer falls back to stale `Waiting for context` state there
  - the sidebar shell can mount in Reader with visible scope, suggested actions, and composer chrome
  - the Reader composer now accepts real typed input, and typing unlocks `Send`
  - clicking `Send` is no longer inert; the draft clears, which proves the frontend dispatch path is live
  - send/session failures before streaming now surface through session error state in tests instead of failing silently
  - the top-toolbar toggle still exists and must be treated as a temporary debug/fallback affordance, not the final placement contract
- Current project risk is now narrower:
  - Library native-host acceptance still needs an explicit daily-profile pass on regular items and PDF attachment items
  - Reader and Library tab-switch churn still need wider regression coverage
  - manual send still does not settle into a visible active-thread state after the draft clears
  - the current `Model` / `Max Context` settings UI still needs to be collapsed into the final `API key`-only release contract
  - no frontend milestone beyond `M0` should be treated as complete until packaged smoke proves it

## Current Blockers

- `Settings` renders again and is editable, but save/reopen/restart validation in the daily profile is still required before `M1` can turn green.
- the release-facing Settings contract is now explicitly `API key` only; daily-profile and packaged verification still need to confirm the simplified pane behaves correctly.
- the sidebar shell mounts and accepts input, but there is still a send/session-state issue to resolve before `M4` is acceptable.
- `Library` native-host behavior still needs explicit daily-profile verification on both regular items and PDF attachment items before `M2` can turn green.
- the top-toolbar toggle remains a temporary debug/fallback control and is not acceptable as the final discovery contract.

## Verified Facts Vs Open Evidence

Verified now:

- `Settings` opens a real Deepseek Copliot pane in the daily profile instead of a blank surface.
- `API Key` is a real secure text field in the daily profile.
- the settings pane source is now reduced in code to the release-facing `API key`-only contract.
- Reader scope resolution follows the active PDF tab instead of a stale Reader tab.
- the Reader shell can mount with visible chrome, scope, and composer affordances.
- the Reader composer accepts typed input.
- typing into the Reader composer unlocks `Send`.
- clicking `Send` clears the draft, confirming that the frontend event path is firing.
- first-message persistence failures now produce visible session-error state in tests.

Still missing runtime evidence:

- proof that editing `apiKey` survives save, reopen, and full restart
- proof that the release-facing Settings contract is narrowed to `API key` only in the real daily profile and packaged path, with DeepSeek defaults and automatic context compression handled internally
- proof that Library native-host behavior is correct for both regular items and PDF attachment items
- proof that Reader and Library survive tab-switch churn without duplicate mounts or false-visible states
- proof that `Explain` and `Ask...` leave the mounted shell interactive after handoff
- proof that manual send creates a visible active thread or visible response state instead of clearing the draft and returning to the shell home state
- proof that packaged `.xpi` behavior matches the daily-profile pass after full restart

## Next Acceptance Pass

Do not flip any milestone based on partial observation. The next acceptance loop should record these exact pass/fail decisions:

- `M1` passes only if Settings is visible, editable, saveable, and persistent after reopen in the daily profile, then matches the same behavior after packaged restart.
- `M1.1` passes only if the user-facing Settings contract is simplified to `API key` only.
- `M2` passes only if the Library native host behaves the same on a regular item and a PDF attachment item, while hiding and restoring the competing native pane content correctly.
- `M3` passes only if Reader survives PDF tab switches, pane collapse/expand, reload, and restart without duplicate mounts or stale scope.
- `M4` passes only if `Explain` auto-sends, `Ask...` pre-fills only, manual send creates a visible active thread, and the sidebar remains fully interactive after each handoff.
- `M5` passes only if the packaged `.xpi` reproduces the Stage 1 frontend behavior after full Zotero restart.
- `M6` passes only if the restored plugin set preserves the same Settings, Library, Reader, and handoff behavior with no host duplication or blank panes.

## Live Worktree Snapshot

The current dirty worktree is concentrated in the host-first tranche:

- `addon/content/preferences.xhtml`
  preference fragment shape fix plus Zotero-7-safe editable input controls for real Zotero Settings interaction
- `src/services/scopeResolver.ts`
  Library PDF-attachment scope support plus Reader tab-id scope fixes
- `src/services/scopeResolver.test.ts`
  regressions for Library attachment scope and stale Reader scope avoidance
- `src/modules/preferencesPaneSource.test.ts`
  guardrail test that keeps the preferences pane in Zotero fragment form
- `src/ui/ui.ts`, `src/ui/ui.test.ts`, `src/ui/sidebarSection.ts`, `src/ui/sidebarSection.test.ts`, `src/ui/components/Sidebar.tsx`
  active host-ownership, tab refresh, and shell-behavior tranche still in progress

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

- [x] `M0` Repo already has a mountable Deepseek Copliot host implementation
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
- [ ] Verify `apiKey` round-trips between UI and prefs after the settings simplification pass.
- [x] Simplify the release-facing Settings contract to `API key` only after the current send/session blocker is solved.
  Keep DeepSeek default model selection and default context budget internal, and handle overflow through automatic truncation / compression.
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
- [ ] Ensure manual send creates or opens a visible active thread instead of clearing the draft and falling back to the home shell.
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
  Daily-profile evidence confirms the pane is no longer blank; edit/save/reopen and packaged restart still need explicit recheck.
- [ ] Library native host visibly stable
- [ ] Reader native host visibly stable
  Daily-profile evidence confirms active PDF tabs now resolve to the live Reader scope; tab churn, restart, and shell operability are still pending.
- [ ] `Explain` auto-send handoff works
- [ ] `Ask...` prefill-only handoff works
- [ ] full Zotero restart preserves the same behavior

## Known UX Gap

- Deepseek Copliot content now mounts into Zotero's native right-side surfaces, but the visible activation affordance is still the top-toolbar toggle.
- Treat the toolbar button as a temporary debug/fallback control.
- Do not accept toolbar-only discovery as the final UI contract for GitHub release readiness.
- Do not spend this tranche redesigning final toolbar UX; the current requirement is host stability inside native Library and Reader panes.

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
