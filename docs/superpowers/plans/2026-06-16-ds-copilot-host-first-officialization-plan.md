# Deepseek Copliot Host-First Officialization Plan

Date: 2026-06-16
Status: Active planning baseline
Owner: AgentPaper
Related spec:

- [Host-First Frontend Stabilization Design](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [Host-First Frontend Task Board](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [Reference Adoption Guide](/Users/liang/Project/agentpaper_zotero/docs/reference-adoption.md)
- [Zotero Dev Workbench](/Users/liang/Project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [Zotero Dev Smoke Checklist](/Users/liang/Project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

## 1. Why This Plan Exists

The repository already has a real Zotero plugin implementation and a valid host-first direction.

The current problem is narrower:

- public behavior is still anchored to the right goal
- but implementation boundaries are not strict enough yet
- official Zotero surfaces are being used at the outer layer
- private host details and compensating logic still leak into critical paths

This plan turns the current project from a working-but-fragile plugin into an officially grounded, reviewable, and releaseable Zotero-native plugin.

## 2. Project Judgment

This project is not greenfield and it is not blind trial-and-error.

What is already correct:

- packaged `.xpi` plus Zotero restart is treated as the true acceptance gate
- the accepted UI surface is the native right-side pane in Library and Reader
- the repo already uses official host entry points such as `PreferencePanes`, `ItemPaneManager`, and `Reader.registerEventListener`
- the repo already distinguishes official docs from reference projects

What is still risky:

- Reader behavior still depends on private or weakly typed host details
- Settings behavior still uses more custom form wiring than necessary for simple preferences
- host lifecycle code contains compensating logic that suggests incomplete convergence on Zotero's official lifecycle
- `zotero-types` is installed and useful, but not yet used as a strict boundary tool
- future work could drift toward agent-platform expansion before host acceptance is fully proven

## 3. Locked Direction

This plan locks the following decisions until the host-first acceptance path is green:

- Deepseek Copliot remains a reading-first Zotero plugin, not a general agent platform
- the immediate target is Zotero 9 packaged stability, not feature breadth
- the official content surface is the native right-side pane in both Library and Reader
- toolbar-only discovery remains a regression, not an acceptable fallback
- provider, evidence, or agent-platform expansion must not advance ahead of host acceptance
- official Zotero docs and stable public APIs are the first source of truth
- reference projects are pattern libraries only

## 4. Non-Goals For This Plan

This plan does not authorize:

- MCP platform expansion
- skills portal or external runtime bridge work
- major UI redesign outside the native host constraints
- broad provider abstraction growth
- large persistence redesign before host acceptance passes

## 5. Acceptance Model

No milestone in this plan is complete unless its smallest meaningful automated gate passes first and its required real Zotero evidence is captured after packaged install.

Use this order only:

1. focused tests
2. broader local test/build gate
3. packaged `.xpi` verification
4. real Zotero smoke
5. Zotero cold restart repeat

## 6. Execution Principles

### Principle A: Official-first, reference-second

For each host-facing change:

1. check the official Zotero doc or template path first
2. check `zotero-types` for the public shape
3. use Beaver only for orchestration patterns
4. use `llm-for-zotero` only for test-gate and safety ideas

### Principle B: Remove guesswork from host boundaries

Every private host dependency must be classified as one of:

- removable now
- unavoidable for now but wrapped behind one narrow adapter
- blocked pending upstream clarification

Private access must not remain scattered through feature code.

### Principle C: Host acceptance outranks feature expansion

If any of these are not yet green, stop adding new product behavior:

- Settings round-trip
- Library native host stability
- Reader native host stability
- Reader handoff interactivity
- packaged restart stability

### Principle D: Narrow lanes, explicit ownership

Every change must declare its lane before editing:

- `agent-workflow`
- `settings`
- `reader-host`
- `composer`
- `provider-context`
- `release-build`

Cross-lane changes must be split unless one acceptance gate truly requires a combined patch.

## 7. Workstreams

### Workstream 1: Official Surface Audit

Lane: `agent-workflow`

Purpose:

- produce a concrete map of every host-facing integration point
- distinguish public API use from private implementation reach-through

Required outputs:

- one inventory of private Zotero or Reader access points
- one inventory of weak custom host types that should be replaced by `zotero-types` or local declaration augmentation
- one short doc note per private dependency:
  - where it is used
  - why it exists
  - whether it can be removed
  - what test or smoke evidence protects it

Primary file targets:

- `src/hooks.ts`
- `src/modules/readerIntegration.ts`
- `src/ui/ui.ts`
- `typings/**`
- `docs/zotero-doc-index.md`

Completion rule:

- no unresolved host-private access remains undocumented

### Workstream 2: Type Boundary Hardening

Lane: `reader-host`

Purpose:

- turn `zotero-types` from compile support into boundary enforcement

Required outputs:

- unified host main-window type augmentation
- typed Reader event handlers
- narrower notifier and prefs payload types
- removal of low-value local weak host interfaces where public types already exist

Primary file targets:

- `typings/global.d.ts`
- `src/hooks.ts`
- `src/modules/readerIntegration.ts`
- `src/ui/ui.ts`

Completion rule:

- critical host entry points no longer default to `any` when public types already exist

### Workstream 3: Reader Private API Containment

Lane: `reader-host`

Purpose:

- stop feature code from directly depending on multiple private Reader internals

Required outputs:

- replace direct `_registeredListeners` mutation with public unregister flow where possible
- isolate any unavoidable Reader-private access into one adapter or helper
- document runtime guards around any remaining private access

Primary file targets:

- `src/modules/readerIntegration.ts`
- optional new helper such as `src/modules/readerPrivate.ts`
- related Reader tests

Completion rule:

- private Reader access no longer appears as ad hoc inline logic across multiple functions

### Workstream 4: Settings Officialization

Lane: `settings`

Purpose:

- make simple settings feel like a Zotero plugin surface, not a custom mini web app

Required outputs:

- keep only the intended release-facing settings contract
- reduce custom wiring for simple persisted fields where Zotero-native preference binding is sufficient
- preserve custom JS only where the feature truly requires it, such as richer preset editing

Primary file targets:

- `addon/content/preferences.xhtml`
- `addon/prefs.js`
- `src/modules/preferencesPane.ts`
- `src/services/settingsManager.ts`
- settings tests

Completion rule:

- simple fields are as close to native prefs behavior as practical without breaking the planned UX

### Workstream 5: Host Lifecycle Simplification

Lane: `reader-host`

Purpose:

- reduce compensating host logic and make window and surface ownership more deterministic

Required outputs:

- one host and one React root per surface per window
- explicit stale mount cleanup
- fewer retry-style patches masking unclear lifecycle truth
- stable separation between section registration, mount ownership, and refresh flow

Primary file targets:

- `src/ui/ui.ts`
- `src/ui/sidebarSection.ts`
- `src/utils/windowLifecycle.ts`
- host lifecycle tests

Completion rule:

- duplicate prevention, teardown, and refresh behavior are proven first in tests, then in packaged smoke

### Workstream 6: Thread Visibility And Handoff Completion

Lane: `composer`

Purpose:

- finish the minimum usable frontend loop after the host surface is trustworthy

Required outputs:

- `Explain` auto-send remains interactive
- `Ask...` prefill-only remains interactive
- manual send creates a visible active thread or a visible actionable error

Primary file targets:

- `src/ui/components/Composer.tsx`
- `src/ui/components/sidebarViewModel.ts`
- `src/ui/components/Sidebar.tsx`
- `src/ui/readerActionFlow.ts`
- related tests

Completion rule:

- send flow is no longer "draft clears but no visible thread state"

## 8. Ordered Milestones

### Milestone M1: Official Boundary Inventory

Goal:

- know exactly where the project is still leaning on unstable host details

Must complete before:

- any new feature expansion

Evidence:

- documented inventory
- follow-up tasks linked to concrete files

### Milestone M2: Typed Host Boundary

Goal:

- remove avoidable `any` from the main host integration seam

Must complete before:

- meaningful Reader stabilization claims

Evidence:

- focused type and unit tests
- reviewed reduction in weak local host interfaces

### Milestone M3: Reader Private API Containment

Goal:

- reduce private Reader reach-through to one controlled layer

Must complete before:

- calling Reader integration stable

Evidence:

- focused Reader tests
- packaged Reader smoke notes

### Milestone M4: Settings Surface Officialization

Goal:

- make the settings surface predictable, minimal, and restart-safe

Evidence:

- settings-focused tests
- packaged edit/save/reopen/restart pass

### Milestone M5: Native Host Stability

Goal:

- Library and Reader hosts behave deterministically in the native right pane

Evidence:

- host lifecycle tests
- packaged smoke in Library and Reader
- cold restart repeat

### Milestone M6: Closed-Loop Frontend Usability

Goal:

- handoff and manual send produce a visible usable conversation flow

Evidence:

- composer and sidebar tests
- packaged smoke for `Explain`, `Ask...`, and manual send

### Milestone M7: Controlled Expansion Gate

Goal:

- only after M1 through M6 are green, reopen evidence/provider expansion

Allowed next topics:

- evidence provider polish
- persistence integrity hardening
- release narrative cleanup

Not allowed next topics:

- platform expansion beyond Zotero plugin scope

## 9. Verification Map

### Smallest meaningful automated gates

Official boundary and typing work:

```bash
npm test -- src/modules/readerIntegration.test.ts src/ui/ui.test.ts src/utils/windowLifecycle.test.ts
```

Settings work:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts
```

Composer and handoff work:

```bash
npm test -- src/ui/components/Composer.test.tsx src/ui/components/sidebarViewModel.test.ts src/ui/readerActionFlow.test.ts
```

Broader gate:

```bash
npm test
npm run build:dev:xpi
npm run verify:xpi
```

Release-facing gate:

```bash
npm run build:release:xpi
```

### Required real Zotero evidence after packaged install

- Add-ons entry visible
- Settings pane opens
- Settings edit/save/reopen works
- Settings survives restart
- Library native host works on regular item and PDF attachment item
- Reader native host works on active PDF tab and after tab switch
- `Explain` auto-send works
- `Ask...` prefill-only works
- manual send creates visible thread state or visible error
- cold restart preserves the same path

## 10. Stop Conditions

Stop and do not expand scope when:

- Add-ons import is not reproven in the current pass
- a host surface depends on a new private Zotero field not yet documented
- a new feature request would widen the product boundary before M1 through M6 are green
- a mixed-lane patch makes acceptance ambiguous
- real smoke produces two same-class failures in the same layer

## 11. Multi-Agent Execution Model

Use subagents only for explicit parallel work with disjoint ownership.

Recommended split:

- Explorer
  - official API audit
  - private dependency inventory
  - `zotero-types` coverage gaps
- Worker A
  - Reader and host type boundary hardening
- Worker B
  - Settings officialization
- Reviewer
  - verification review
  - smoke evidence review
  - regression and risk summary

Do not assign one worker both host-boundary cleanup and provider expansion in the same tranche.

## 12. Immediate Next Tranche

The next implementation tranche should be:

1. `M1 official boundary inventory`
2. `M2 typed host boundary`
3. `M3 Reader private API containment`

Do not start from provider or evidence work.

The fastest high-value questions are:

- where are all current private Zotero and Reader dependencies
- which ones are removable immediately
- which host types should come from `zotero-types` instead of local weak interfaces
- whether `PreferencePanes` simple fields can be narrowed toward more native prefs behavior without breaking current tests

## 13. Definition Of Success

This plan succeeds when Deepseek Copliot can be described honestly as:

- a Zotero-native plugin first
- a host-stable packaged addon second
- an AI reading assistant third

If those three statements cannot all be defended with packaged evidence, the work is not complete.
