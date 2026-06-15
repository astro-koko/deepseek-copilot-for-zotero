# Deepseek Copliot Host-First Frontend Stabilization Design

Date: 2026-05-31
Status: Active execution spec
Scope: Zotero frontend host stabilization for a usable plugin baseline

## 1. Purpose

This document resets the project's immediate objective from "feature-complete AI assistant" to "usable Zotero plugin frontend."

The next delivery target is not provider breadth, richer product flows, or GitHub release automation. The next delivery target is a Deepseek Copliot build that:

- appears reliably in Zotero Add-ons
- exposes a working Settings pane
- renders stably in Library and Reader native right-side hosts
- survives hot reload and full Zotero restart
- accepts Reader handoff actions in a predictable way

This is the minimum base required before broader model behavior or public release work can be trusted.

## 2. Current Project Reality

The repository already contains a meaningful host implementation. This is not a greenfield rewrite.

Current evidence in the codebase:

- preferences registration and hydration exist in `src/hooks.ts` and `src/modules/preferencesPane.ts`
- native host ownership, fallback section mounting, toolbar state, and teardown live in `src/ui/ui.ts` and `src/ui/sidebarSection.ts`
- Reader popup/context actions already dispatch `readerSelectionAction` via `src/modules/readerIntegration.ts`
- draft-building helpers already exist in `src/ui/readerActionFlow.ts`
- host lifecycle tests already exist in `src/ui/ui.test.ts`, `src/ui/sidebarSection.test.ts`, and `src/modules/preferencesPane.test.ts`

The problem is not "there is no plugin." The problem is that the host-facing parts are still too coupled and not yet stable enough to serve as a trustworthy frontend base.

Current verified runtime state:

- `Settings` is visible again and no longer opens as a blank pane
- `Settings` text controls are now real editable Zotero-7-safe controls
- Reader scope resolution now follows the active PDF tab instead of leaking stale Reader state
- the sidebar shell can mount in Reader and show the expected chrome
- the Reader composer is now actually editable, and manual typing unlocks `Send`
- the top-toolbar toggle still exists only as a temporary debug/fallback affordance

Current acceptance gaps:

- `Settings` still needs explicit edit/save/reopen/restart validation in the daily profile
- `Library` still needs explicit daily-profile acceptance on both regular items and PDF attachment items
- manual send still does not settle into a visible active-thread state after the draft clears
- packaged restart and restored-plugin compatibility are still required before any frontend milestone can be called complete

Management interpretation of those gaps:

- these are acceptance and operability gaps, not evidence that the host-first direction is wrong
- the team should treat the current toolbar affordance as transitional scaffolding, not as the target product contract
- the final Settings contract has now tightened further: user-facing configuration should collapse to `API key` only
- no one should broaden scope into provider polish or release packaging cleanup until the missing host evidence is collected

## 3. Product Goal For This Phase

Phase goal:

Deliver a host-stable Deepseek Copliot frontend that works in the user's real daily Zotero profile and can later become the base for a public GitHub release.

Success in this phase means:

- the plugin feels real inside Zotero, not merely present
- the visible frontend behavior matches DOM and lifecycle state
- debugging is anchored in the real host environment instead of clean-profile illusions

## 4. Environment And Assumptions

The canonical acceptance environment is the current daily Zotero profile, not a temporary clean profile.

Assumptions for this phase:

- Zotero native settings are treated as baseline, not the primary suspect
- root causes should be investigated first in three buckets only:
  - Deepseek Copliot host code
  - hot reload / plugin reload lifecycle
  - installed-plugin surface conflicts
- provider failures are not used to explain missing host surfaces

## 5. Host Surface Contracts

### Add-ons Entry

`Deepseek Copliot` must appear in Add-ons after packaged installation. If it does not, stop and debug packaging/startup only.

### Settings Pane

The Settings pane is a required first-class surface.

Current status:

- visible again in the daily profile
- controls are now genuinely editable again in the daily profile
- not yet accepted until edit/save/reopen/restart behavior is explicitly re-verified

Contract:

- the left navigation entry is present
- selecting it opens a real pane, not a blank page
- `apiKey`, `model`, and `maxContextBudget` are editable
- the intended release contract is narrower: only `apiKey` remains user-facing
- saved values persist across reopening the pane and restarting Zotero
- repeated `onPrefsEvent("load")` calls are idempotent
- long contexts are handled by internal truncation/compression, not by a user-managed max-context field

### Library Native Host

The official Library UI surface is the native right pane host, not the fallback section.

Current status:

- still not accepted
- current work adds Library PDF-attachment scope support, but the daily-profile pass is still pending

Contract:

- the Deepseek Copliot host mounts into the native Library pane
- regular items and PDF attachment items both show the same shell
- opening Deepseek Copliot hides the conflicting native pane body content for the active layer
- closing Deepseek Copliot restores native content fully
- reload, tab switching, pane collapse, and restart never create duplicate mounts or fake-visible states
- activation should feel local to the right-side surface; a top-toolbar toggle may remain temporarily as a debugging or fallback affordance, but it is not the final placement contract

### Reader Native Host

The official Reader UI surface is the native Reader context pane.

Current status:

- active PDF tabs now resolve against the selected Zotero tab ID
- shell mount is visible, but operability and churn resistance still need acceptance coverage

Contract:

- mount to `#zotero-context-pane-inner` first
- fall back to `#zotero-context-pane` only if the inner container is unavailable
- keep exactly one Reader host and one React root per window
- survive PDF switches, layout changes, pane collapse/expand, reload, and restart
- content placement and activation affordance are separate concerns; the native Reader pane is the official content surface even if a temporary toolbar toggle still exists

### Reader Handoff

Reader actions are part of the frontend acceptance scope.

Current status:

- flow wiring exists
- acceptance is blocked until the mounted shell is fully interactive after handoff

Contract:

- `Explain` opens the sidebar and auto-submits a generated draft into the thread flow
- `Ask...` opens the sidebar and pre-fills the draft without auto-submit
- the sidebar input, thread area, and empty state remain interactive after handoff

## 6. Delivery Sequence

The implementation order is fixed:

1. Add-ons entry and startup visibility
2. Settings pane stability
3. Library native host stability
4. Reader native host stability
5. Reader handoff stability
6. packaged `.xpi` frontend acceptance
7. compatibility regression with the restored plugin set

Do not skip ahead to provider work before steps 1 through 5 are stable.

## 7. Required Runtime Evidence

Every meaningful host debugging pass should capture the same runtime facts:

- `Zotero_Tabs.selectedType` and `selectedID`
- direct children of `#zotero-item-pane` and `#zotero-context-pane`
- count, parent, display, and dimensions of `ai-assistant-pane-library-mount` and `ai-assistant-pane-reader-mount`
- whether the native right-pane content is actually hidden or still present underneath

Frontend acceptance should additionally record:

- whether Settings values round-trip after save and reopen
- whether the same behavior survives a full Zotero restart from a packaged `.xpi`
- whether `Explain` and `Ask...` leave the sidebar interactive instead of merely visible
- whether the observed surface was reached through the native pane or only through the temporary toolbar toggle

Weak signals such as "button exists" or "section registered" are not acceptance evidence.

## 8. Minimal Isolation Policy

Minimal isolation is allowed, but only to evaluate right-pane and Reader-surface conflicts.

Isolation order:

1. `Zotero Pdf2zh`
2. `RosettaPDF`
3. `Ethereal Style`
4. any other currently enabled plugin that modifies right-pane or Reader UI

Do not prioritize disabling unrelated plugins such as `Better BibTeX`, `Add-on Market`, or `Zotero MCP Plugin` unless evidence later points there.

## 9. Beaver-Guided Rebuild Strategy

Beaver is the reference for host decomposition and Reader event flow, not for cloud product behavior.

Adopt from Beaver:

- startup and shutdown discipline
- Reader event registration / cleanup pattern
- separation between host integration and conversation UI logic
- the expectation that Reader actions dispatch into the sidebar flow, not into a separate modal path

Do not import from Beaver into this phase:

- cloud auth and account flows
- sync and remote thread infrastructure
- embeddings, MCP, or agent-platform systems

## 10. Workstreams

### Workstream A: Window Lifecycle And Host Ownership

Primary files:

- `src/hooks.ts`
- `src/ui/ui.ts`
- `src/ui/sidebarSection.ts`
- `src/utils/windowLifecycle.ts`

Goal:

make host creation, reattachment, visibility control, and teardown deterministic per window and per surface

### Workstream B: Settings Pane Reliability

Primary files:

- `src/modules/preferencesPane.ts`
- `addon/content/preferences.xhtml`
- `addon/prefs.js`

Goal:

ensure the Settings surface is idempotent, persistent, and safe across reopen/restart

### Workstream C: Reader Handoff And Interactive Shell

Primary files:

- `src/modules/readerIntegration.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/components/Sidebar.tsx`
- `src/ui/components/sidebarViewModel.ts`

Goal:

ensure Reader-originated actions reliably open the sidebar and land in an interactive draft/thread flow

### Workstream D: Delivery And Compatibility Control

Primary files:

- `docs/zotero-dev-workbench.md`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-sidebar-stability-review.md`
- `package.json`
- `scripts/verify-build-artifact.mjs`

Goal:

keep hot reload, packaged acceptance, and compatibility regression documented and repeatable

## 11. Non-Goals For This Phase

These are intentionally deferred:

- provider correctness beyond the minimum needed to avoid blocking the UI
- final discovery UX beyond the temporary toolbar fallback needed to expose the native-pane host during stabilization
- release-readiness claims based only on toolbar visibility or proxy-mode `npm start` behavior
- DeepSeek quality tuning
- broad multi-plugin compatibility fixes outside right-pane and Reader host conflicts
- release automation, changelog discipline, and public release packaging polish
- broader product redesign

## 12. Git And Progress Rules

Project management for this phase follows these rules:

- keep the branch focused on host-first frontend stabilization until the frontend gate is complete
- do not mix provider experiments into the same milestone unless they directly block surface behavior
- update the execution board when milestones or blockers materially change
- prefer small commits grouped by workstream or acceptance gate
- do not treat `npm start` success as release evidence

## 13. Exit Criteria

This phase is complete only when all of the following are true:

- packaged `.xpi` installs and appears in Add-ons
- Settings pane works and persists state
- Library native host works and stays stable
- Reader native host works and stays stable
- `Explain` and `Ask...` handoff behave correctly
- full Zotero restart preserves the same behavior
- the restored plugin set does not re-break the frontend host loop
