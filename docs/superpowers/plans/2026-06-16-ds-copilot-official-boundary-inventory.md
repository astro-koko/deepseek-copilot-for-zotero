# Deepseek Copliot Official Boundary Inventory

Date: 2026-06-16
Status: Active
Classification: task
Related plan:

- [Host-First Officialization Plan](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-06-16-ds-copilot-host-first-officialization-plan.md)

## 1. Purpose

This document completes `M1 official boundary inventory`.

Its goal is to identify where the plugin already uses stable Zotero surfaces correctly, where it still reaches through private host details, and where local weak typing is diluting the value of `zotero-types`.

This is not a rewrite proposal.

This is a boundary map for the next implementation tranches.

## 2. Summary Judgment

The current codebase is in a mixed state:

- official Zotero entry points are already used for startup, preferences registration, item-pane registration, and Reader event registration
- but critical Reader and scope-resolution behavior still depends on private host details
- several host-facing files weaken `zotero-types` with local `any`, ad hoc window interfaces, and broad payload bags

The project is therefore not "blind trial and error", but it is also not yet fully "officialized".

The immediate engineering goal is not more feature breadth.

The immediate goal is to reduce boundary ambiguity.

## 3. Public API Surfaces Already In Use

These are the current host-facing uses that already align with stable public plugin surfaces.

### Startup and host registration

- `Zotero.PreferencePanes.register()` in [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:61)
- `MozXULElement.insertFTLIfNeeded()` in [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:128)
- `Zotero.getMainWindows()` in [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:74)
- `Zotero.ItemPaneManager.registerSection()` in [src/ui/ui.ts](/Users/liang/Project/agentpaper_zotero/src/ui/ui.ts:154)
- `Zotero.ItemPaneManager.unregisterSection()` in [src/ui/ui.ts](/Users/liang/Project/agentpaper_zotero/src/ui/ui.ts:141)
- `Zotero.Notifier.registerObserver()` in [src/ui/ui.ts](/Users/liang/Project/agentpaper_zotero/src/ui/ui.ts:276) and [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:289)
- `Zotero.Notifier.unregisterObserver()` in [src/ui/ui.ts](/Users/liang/Project/agentpaper_zotero/src/ui/ui.ts:297) and [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:301)

### Reader registration

- `Zotero.Reader.registerEventListener()` in [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:179)
- `Zotero.Reader.getByTabID()` in [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:109)

### Preferences and item selection

- `Zotero.Items.get()` in [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:14)
- `Zotero.getMainWindow()` in [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:34)

These APIs should remain the preferred seam.

## 4. Private Host Dependencies

This section lists the current private or weakly stable host dependencies that materially affect plugin behavior.

### P1. Reader listener cleanup rewrites private listener state

Location:

- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:158)

Current behavior:

- cleanup mutates `Zotero.Reader._registeredListeners`

Why it is risky:

- it bypasses the public unregister contract
- it assumes the internal listener storage shape is stable
- it can silently break if Zotero changes internal listener bookkeeping

Current classification:

- removable now

Required next action:

- replace with `Zotero.Reader.unregisterEventListener()` and validate cleanup behavior in focused tests

### P2. Reader selection extraction depends on `_internalReader._primaryView._selectionRanges`

Locations:

- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:110)
- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:151)

Current behavior:

- selected text is read from `_internalReader._primaryView._selectionRanges`

Why it is risky:

- this is a private implementation chain
- it appears in more than one module
- the same private read is duplicated instead of being isolated

Current classification:

- unavoidable for now but should be wrapped

Required next action:

- move this probe into one narrow Reader-private helper with runtime guards
- eliminate duplicate inline reads in feature code

### P3. Reader page extraction depends on `PDFViewerApplication.pdfViewer`

Locations:

- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:122)
- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:245)

Current behavior:

- current page is read through `_iframeWindow.PDFViewerApplication.pdfViewer`

Why it is risky:

- this is not a stable public plugin API
- it is duplicated in two places
- it is tightly coupled to the embedded PDF viewer implementation

Current classification:

- unavoidable for now but should be wrapped

Required next action:

- move into the same Reader-private helper layer as selected text extraction

### P4. Reader tab fallback depends on private tab registry `_tabs`

Location:

- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:171)

Current behavior:

- scope fallback inspects `mainWindow.Zotero_Tabs._tabs`

Why it is risky:

- `_tabs` is private host state
- the code makes structural guesses about tab payload shape
- this directly affects Reader scope correctness

Current classification:

- unavoidable for now but should be wrapped and documented

Required next action:

- isolate tab fallback probing into one helper
- add a comment and smoke evidence requirement specifically for this fallback

### P5. Reader attachment fallback inspects arbitrary nested keys

Location:

- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:191)

Current behavior:

- attachment id is guessed from `itemID`, `itemId`, `attachmentID`, `attachmentId`, `id`, including nested object values

Why it is risky:

- this is a heuristic over private data shapes
- it may succeed by accident and fail silently on host changes

Current classification:

- unavoidable for now but should be wrapped and tested as a compatibility shim

Required next action:

- keep the heuristic in one helper only
- test it as a compatibility shim instead of letting the shape spread through feature code

## 5. Weak Type Boundaries

These are places where the code weakens host typing more than necessary.

### T1. Reader event handlers are typed as `any`

Locations:

- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:25)
- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:54)
- [src/modules/readerIntegration.ts](/Users/liang/Project/agentpaper_zotero/src/modules/readerIntegration.ts:101)

Why it matters:

- `zotero-types` already provides Reader event map typing
- this is a direct missed opportunity to tighten the public boundary

Required next action:

- switch handlers to typed Reader event signatures before deeper refactors

### T2. Main-window host shape is redefined locally as a weaker custom interface

Location:

- [src/ui/ui.ts](/Users/liang/Project/agentpaper_zotero/src/ui/ui.ts:19)

Current behavior:

- `AIAssistantWindow` redefines `ZoteroPane`, `ZoteroContextPane`, and `Zotero_Tabs` weakly

Why it matters:

- local weak typing obscures what Zotero already exposes through `zotero-types`
- feature code must cast more often and trust less

Required next action:

- replace this with declaration augmentation or a unified host-window type built on top of Zotero types

### T3. Event bus and scope callback seam still uses broad `any`

Locations:

- [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:15)
- [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:133)
- [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:231)
- [src/hooks.ts](/Users/liang/Project/agentpaper_zotero/src/hooks.ts:236)

Why it matters:

- startup and lifecycle code is the wrong place to keep ambiguous payload shapes
- these seams propagate weak typing into UI and notifier handling

Required next action:

- use `ReturnType<typeof getCurrentScope>` for scope payloads
- use `Record<string, unknown>` or tighter lifecycle payload shapes for notify/prefs events

### T4. Scope resolver uses `any` at the core host seam

Locations:

- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:8)
- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:37)
- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:104)
- [src/services/scopeResolver.ts](/Users/liang/Project/agentpaper_zotero/src/services/scopeResolver.ts:164)

Why it matters:

- scope resolution is part of the plugin's truth model
- weak typing here weakens every surface that depends on scope

Required next action:

- split public host access from compatibility shims
- type the public path strongly and isolate private fallback path separately

### T5. UI handoff still relies on weak `selectedType` probing

Location:

- [src/ui/components/Sidebar.tsx](/Users/liang/Project/agentpaper_zotero/src/ui/components/Sidebar.tsx:176)

Why it matters:

- handoff flow correctness depends on host surface checks
- weak typing here is small but sits on a critical user-visible path

Required next action:

- route through the unified host-window type instead of `(Zotero.getMainWindow() as any)`

## 6. Boundary Priorities

### Immediate fix now

- `P1 Reader listener cleanup`

Reason:

- it is high-risk and has a public replacement path

### Immediate containment next

- `P2 Reader selected text`
- `P3 Reader current page`
- `P4 Reader tab fallback`
- `P5 attachment id heuristic`

Reason:

- these may remain temporarily necessary, but must stop leaking through multiple feature files

### Immediate typing tranche

- `T1 Reader event typing`
- `T2 unified host-window type`
- `T3 lifecycle payload tightening`

Reason:

- these improve the main host seam without changing product behavior

### Follow after host boundary tightening

- `T4 scope resolver public/private split`
- `T5 sidebar handoff host typing`

Reason:

- these are best handled after the main type seam is established

## 7. Proposed M2 And M3 Execution Order

### Tranche A: Host type seam

Scope:

- `typings/global.d.ts`
- `src/hooks.ts`
- `src/ui/ui.ts`
- `src/utils/windowLifecycle.ts`

Goal:

- define one shared host-window extension type and tighten lifecycle payloads

### Tranche B: Reader event seam

Scope:

- `src/modules/readerIntegration.ts`

Goal:

- type Reader event handlers and remove private listener cleanup mutation

### Tranche C: Reader compatibility shim

Scope:

- `src/modules/readerIntegration.ts`
- `src/services/scopeResolver.ts`
- optional `src/modules/readerPrivate.ts`

Goal:

- isolate all unavoidable private Reader probing behind one adapter

### Tranche D: Scope resolver cleanup

Scope:

- `src/services/scopeResolver.ts`
- related tests

Goal:

- separate stable public scope resolution from private compatibility fallback logic

## 8. Verification Expectations

Before broader smoke, the next focused checks should cover:

- Reader listener register/unregister behavior
- selected text extraction fallback behavior
- page extraction fallback behavior
- scope resolution from active Reader tab
- scope resolution from Reader tab fallback data

Then run:

```bash
npm test -- src/ui/readerActionFlow.test.ts src/ui/ui.test.ts src/utils/windowLifecycle.test.ts src/services/scopeResolver.test.ts
```

Then:

```bash
npm test
npm run build:dev:xpi
npm run verify:xpi
```

Real Zotero smoke is required before claiming Reader host stability improved.

## 9. Definition Of Done For M1

`M1 official boundary inventory` is complete when:

- every current private Reader or host dependency is listed
- each dependency is classified
- each dependency has an explicit next action
- the next tranches for `M2` and `M3` are sequenced

That condition is now met by this document.
