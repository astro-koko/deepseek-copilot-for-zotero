# DS Copilot Zotero Dev Workbench

This document is the repo-specific workbench for developing and validating DS Copilot inside Zotero.

The default target is:
- Zotero 9 release for daily development and main smoke
- Zotero 10 beta only for compatibility checks

We do not widen `strict_max_version` until the packaged `.xpi` passes a Zotero 10 beta smoke loop.

## Current execution target

The current execution target is host-first frontend stabilization, not general feature expansion.

Formal acceptance environment:

- the current daily Zotero profile is the real frontend acceptance target
- clean or temporary profiles may be used for comparison, but not as the primary pass signal
- Zotero native settings are treated as baseline unless evidence shows otherwise

Primary issue buckets for this phase:

- DS Copilot host code
- hot reload / plugin reload lifecycle
- installed-plugin surface conflicts

The intended user-facing surface for this phase is the native Zotero right-side pane entry in both Library and Reader. A top-toolbar `D...` artifact or any toolbar-only DS Copilot discovery path is a host regression, not an acceptable fallback.

## Environment baseline

Required local tools:
- Zotero 9 release
- Zotero 10 beta if you are doing compatibility checks
- Node.js LTS
- Git
- `rg`, `unzip`, `jq`

Required local setup:
1. Copy `.env.example` to `.env`.
2. Point `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` to the Zotero app binary.
3. Point `ZOTERO_PLUGIN_PROFILE_PATH` to a dedicated dev profile.
4. Point `ZOTERO_PLUGIN_DATA_DIR` to the real Zotero data directory you want to use during smoke tests.
5. Set `DEEPSEEK_API_KEY` and optionally `DEEPSEEK_MODEL`.
6. Set `TAVILY_API_KEY` if you want Tavily-backed web verification available in the dev profile.
7. Optionally set `DS_COPILOT_EVIDENCE_PROVIDER` to `mcp-web-search` or `tavily`, and `DS_COPILOT_EVIDENCE_ENABLED=1` if you want the sidebar to start with evidence mode enabled.

Optional local setup:
- Set `ZOTERO_DEBUGGER=1` before `npm start` when you need `-ZoteroDebugText` and `-jsdebugger`.

## Three loops

### Loop 1: Logic loop

Use this loop when changing services, state, parser logic, persistence, or view models.

1. Edit logic only.
2. Run focused Vitest first.
3. Run `npm test` once the focused test is green.
4. Do not open Zotero until the behavior is covered by tests.

Use this loop for:
- `src/services/**`
- `src/types/**`
- `src/ui/**ViewModel*`
- pure helpers

### Loop 2: Host loop

Use this loop when changing Zotero integration, UI registration, Reader handoff, or settings registration.

1. Run `npm start`.
2. Change one layer at a time in this order:
   - Add-ons visibility and startup
   - Settings pane
   - evidence provider selection and Tavily validation
   - startup and registration
   - Library native host through the right-side pane entry
   - Reader native host through the right-side pane entry
   - Reader actions
   - provider round-trip only after the host loop is stable
3. Use Zotero host tooling to inspect that layer before touching other layers.

For host debugging, collect the same runtime evidence each pass:

- `Zotero_Tabs.selectedType` and `selectedID`
- direct children of `#zotero-item-pane` and `#zotero-context-pane`
- count, parent, display, and size of `ai-assistant-pane-library-mount` and `ai-assistant-pane-reader-mount`
- whether the native right-pane content is truly hidden or merely obscured

Prefer these built-in tools:
- `Tools -> Developer -> Run JavaScript`
- `Help -> Debug Output Logging -> View Output`
- Browser Toolbox via `ZOTERO_DEBUGGER=1 npm start`

### Loop 3: Delivery loop

Use this loop before calling any change done.

1. Run `npm run check`.
2. Import the built `.xpi` from Zotero's plugin manager.
3. Re-run the real smoke checks in Zotero.
4. Restart Zotero and repeat the critical checks.

If a change has not passed the packaged `.xpi` loop, it is not complete.

Reloading the dev plugin is allowed only as an iteration tool. It is not acceptance evidence by itself.

## Fixed triage order

Always debug in this order:
1. Add-ons list shows `DS Copilot`
2. Settings pane exists
3. Library native host exists and is visibly correct through the right-side pane entry
4. Reader native host exists and is visibly correct through the right-side pane entry
5. Reader popup and right-click actions reach the sidebar flow
6. Sidebar can send and receive one real model response
7. Restart Zotero and confirm the same path still works

Do not skip ahead:
- Missing Add-ons entry: inspect install chain only
- Add-ons exists but no Settings pane: inspect prefs registration and pane wiring
- Add-ons exists but no sidebar: inspect startup, registration, native host ownership, and mounting
- Add-ons exists but a top-toolbar `D...` artifact is visible: inspect surface ownership and section registration in `src/ui/ui.ts`
- Reader menu exists but handoff is inert: inspect event handoff before provider code
- UI exists but chat fails: inspect prefs, provider config, request path

## Minimal isolation policy

Minimal isolation is allowed only when evaluating right-pane or Reader host conflicts.

Isolation order:

1. `Zotero Pdf2zh`
2. `RosettaPDF`
3. `Ethereal Style`
4. any other enabled plugin that modifies right-pane or Reader UI

Do not prioritize disabling unrelated plugins such as `Better BibTeX`, `Add-on Market`, or `Zotero MCP Plugin` unless later evidence points there.

## Commands

- `npm test`
  - Full logic regression
- `npm run build`
  - Production build
- `npm run verify:xpi`
  - Confirm packaged addon artifacts exist
- `npm run smoke:xpi`
  - Build plus packaged-artifact gate
- `npm run check`
  - Full acceptance preflight: test, build, verify
- `npm start`
  - Proxy-mode hot reload for rapid iteration only

## When to read upstream docs

Use `docs/zotero-doc-index.md` as the entry point.

Open upstream references when:
- you are unsure whether a behavior is a Zotero host rule vs. a plugin bug
- you need the canonical scaffold or toolkit workflow
- you are working on Preferences, Item Pane sections, Reader integration, menu injection, or shutdown cleanup

## What stays out of this workbench

This workbench intentionally does not define:
- provider-specific SSE debugging workflow
- external MCP server workflows
- release publishing or auto-update hosting

Those can be layered on later after the host loop is stable.
