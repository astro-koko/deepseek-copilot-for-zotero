# Deepseek Copliot Debug Observability Task Board

Date: 2026-06-16
Status: Active task board
Owner: AgentPaper
Related spec:

- [Debug Observability And Regression Workflow Design](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md)
- [Host-First Frontend Stabilization Design](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [Zotero Dev Workbench](/Users/liang/Project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [Zotero Real Smoke Guardrails](/Users/liang/Project/agentpaper_zotero/docs/zotero-real-smoke-guardrails.md)

> For agentic workers: use the repository `zotero-plugin-spec`, `zotero-real-smoke`, and `zotero-release-manager` skills before implementing tasks that touch host surfaces, smoke, or packaging. If Superpowers execution helpers are available in another environment, run this plan task-by-task and update checkboxes as each step lands.

**Goal:** Make recurring user reports diagnosable by adding privacy-safe structured logs, a debug-log export path, issue intake fields, and a layered regression workflow.

**Architecture:** Keep the existing React sidebar, services, and Zotero host integration. Add one small logging utility and instrument key user actions and Zotero API boundaries. Treat packaged XPI smoke as the real acceptance surface.

**Tech Stack:** TypeScript, React, Vitest, Zotero Plugin Toolkit, Zotero Desktop, Zotero File/Prefs/Reader/ItemPane APIs.

---

## File Map

New:

- `src/utils/debugLog.ts`
- `src/utils/debugLog.test.ts`

Modify:

- `.github/ISSUE_TEMPLATE/bug_report.md`
- `docs/zotero-doc-index.md`
- `src/modules/readerIntegration.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/components/Sidebar.tsx`
- `src/ui/components/Composer.tsx`
- `src/modules/preferencesPane.ts`
- `src/services/settingsManager.ts`
- `src/services/threadExport.ts`
- `src/services/chatSession.ts`
- `src/services/chatEngine.ts`
- `src/services/provider/openAICompatibleProvider.ts`
- `src/services/hostSmoke.ts`

Out of scope for this board:

- provider expansion
- UI redesign
- persistence schema migration
- Zotero 10 compatibility widening
- remote telemetry

---

## Task 1: Land The Spec Management Baseline

Lane: `agent-workflow`

Files:

- Add: `docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md`
- Add: `docs/superpowers/plans/2026-06-16-ds-copilot-debug-observability-task-board.md`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.md`
- Modify: `docs/zotero-doc-index.md`

- [x] Step 1: Add the design spec with classification, surfaces, privacy boundary, acceptance criteria, verification, real Zotero smoke, and reference adoption.
- [x] Step 2: Add this task board with P0/P1/P2 sequencing and file ownership.
- [x] Step 3: Update the bug issue template to request debug log JSONL, trace id, install path, profile class, triage layer, and real Zotero evidence.
- [x] Step 4: Update the doc index so future agents find this workflow from the current execution docs.
- [x] Step 5: Verify with:

```bash
git diff --check
```

Completion evidence:

- New spec and plan are present under `docs/superpowers`.
- Bug template contains debug-log intake fields.
- Doc index links the new spec and plan.

---

## Task 2: Add The Privacy-Safe Debug Log Utility

Lane: `agent-workflow`

Files:

- Add: `src/utils/debugLog.ts`
- Add: `src/utils/debugLog.test.ts`

- [x] Step 1: Write failing tests for ring-buffer retention, JSONL export formatting, trace id generation, and sanitizer behavior.
- [x] Step 2: Implement the logger with best-effort `ztoolkit.log` forwarding.
- [x] Step 3: Ensure API keys, Authorization headers, selected text, full prompt content, full PDF text, profile paths, and database paths are removed or summarized.
- [x] Step 4: Re-run:

```bash
npm test -- src/utils/debugLog.test.ts
```

Acceptance:

- Logger failures never throw into product code.
- Tests prove secrets and content fields do not appear in exported JSONL.
- Log entries can include text lengths and booleans such as `hasApiKey`.

Completion evidence:

- `npm test -- src/utils/debugLog.test.ts` passes with 9 tests.
- `npm run build` reached packaged build completion but failed afterward with a TLS network socket error from the scaffold command.
- `npx tsc --noEmit` currently fails on pre-existing host/Reader typing work in `src/hooks.ts`, `src/modules/readerIntegration.ts`, `src/services/scopeResolver.ts`, `src/ui/ui.ts`, and `src/utils/windowLifecycle.test.ts`; keep that remediation in the host/type-boundary lane.

---

## Task 3: Instrument User Action Entry Points

Lane: `composer`

Files:

- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/components/Composer.tsx`
- Modify or add related component tests

- [ ] Step 1: Log render-time disabled reasons for composer send.
- [ ] Step 2: Log clicks for send, stop, new thread, recent chats, settings, export, delete, model toggle, and evidence toggle.
- [ ] Step 3: Attach a trace id to each send/export/delete workflow.
- [ ] Step 4: Add or update focused tests where the action can be tested outside Zotero.
- [ ] Step 5: Run:

```bash
npm test -- src/ui/components/Composer.test.tsx src/ui/components/sidebarViewModel.test.ts src/ui/components/SidebarSource.test.ts
```

Acceptance:

- A "button did nothing" report can be classified as no click, disabled click, or handler failure.

---

## Task 4: Instrument Reader Selection Handoff

Lane: `reader-host`

Files:

- Modify: `src/modules/readerIntegration.ts`
- Modify: `src/ui/readerActionFlow.ts`
- Modify: `src/ui/components/Sidebar.tsx`
- Update: `src/modules/readerIntegration.test.ts`
- Update: `src/ui/readerActionFlow.test.ts`

- [x] Step 1: Log Reader API availability during registration.
- [x] Step 2: Log popup render and context-menu creation with `hasSelection`, `selectedTextChars`, `page`, and `readerItemID`.
- [x] Step 3: Log blocked dispatches for empty text or missing event bus.
- [x] Step 4: Log sidebar receipt of `readerSelectionAction` and whether it auto-sent or prefilled.
- [x] Step 5: Run:

```bash
npm test -- src/modules/readerIntegration.test.ts src/ui/readerActionFlow.test.ts src/services/scopeResolver.test.ts
```

Real Zotero smoke:

- Select PDF text.
- Confirm popup buttons appear.
- Trigger `Explain` and `Ask...`.
- Export debug log and confirm the event chain appears without selected text content.

Completion evidence:

- `npm test -- src/modules/readerIntegration.test.ts src/ui/readerActionFlow.test.ts src/services/scopeResolver.test.ts` passes with 17 tests.
- Reader popup dispatch now carries a trace id and the debug log stores `selectedTextChars` without selected text content.
- `npm test -- src/ui/components/SidebarSource.test.ts src/modules/readerIntegration.test.ts src/ui/readerActionFlow.test.ts src/services/scopeResolver.test.ts` passes with 29 tests after sidebar receipt logging.

---

## Task 5: Instrument Settings And Debug Export

Lane: `settings`

Files:

- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Modify: `src/modules/preferencesPane.ts`
- Modify: `src/services/settingsManager.ts`
- Update: `src/modules/preferencesPane.test.ts`
- Update: `src/services/settingsManager.test.ts`

- [x] Step 1: Add an `Export Debug Log` button to Settings.
- [x] Step 2: Use Zotero file picker or a safe temp fallback path.
- [x] Step 3: Log settings pane load, save, validation start, validation result, and export result.
- [x] Step 4: Ensure API keys are represented only as `hasApiKey` and never logged as values.
- [x] Step 5: Run:

```bash
npm test -- src/modules/preferencesPane.test.ts src/services/settingsManager.test.ts
```

Real Zotero smoke:

- Open Settings.
- Save/reopen.
- Export debug log.
- Restart Zotero and repeat.

Completion evidence:

- `npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/utils/debugLog.test.ts` passes with 41 tests.
- Settings now exposes `Export Debug Log` and writes a JSONL file through the structured logger export helper.

---

## Task 6: Instrument Export And Provider Failure Classes

Lane: `provider-context`

Files:

- Modify: `src/services/threadExport.ts`
- Modify: `src/services/chatSession.ts`
- Modify: `src/services/chatEngine.ts`
- Modify: `src/services/provider/openAICompatibleProvider.ts`
- Update tests under `src/services/**`

- [ ] Step 1: Log export picker, selected path availability, writer chosen, write success, and write failure class.
- [ ] Step 2: Log chat send start, scope transition, user-message persistence, provider start, stream status, abort, and error.
- [ ] Step 3: Keep provider diagnostics metadata-only.
- [ ] Step 4: Run:

```bash
npm test -- src/services/threadExport.test.ts src/services/chatSession.test.ts src/services/chatEngine.test.ts src/services/provider/openAICompatibleProvider.test.ts
```

Acceptance:

- Network failure, provider HTTP error, SSE stream error, abort, and persistence failure are distinguishable in logs.

---

## Task 7: Connect Host Smoke To Debug Evidence

Lane: `reader-host`

Files:

- Modify: `src/services/hostSmoke.ts`
- Update: `src/services/hostSmoke.test.ts`
- Modify: `docs/zotero-dev-smoke-checklist.md`

- [ ] Step 1: Include debug-log summary fields in host smoke output when available.
- [ ] Step 2: Add smoke checklist instructions to export the debug log after failed Reader handoff or export failure.
- [ ] Step 3: Run:

```bash
npm test -- src/services/hostSmoke.test.ts
npm run build:dev:xpi
```

Real Zotero smoke:

- Build dev XPI.
- Install through Add-ons.
- Run Settings, Library, Reader, Reader action, export, and restart checks.

---

## Symptom To Test Map

| User symptom | First test layer | Real Zotero proof |
| --- | --- | --- |
| Button cannot be clicked | `Composer.test.tsx`, `sidebarViewModel.test.ts` | Sidebar click plus debug JSONL |
| Empty API key send | `sidebarViewModel.test.ts`, `chatEngine.test.ts` | Settings empty key and sidebar disabled reason |
| Selected text does nothing | `readerIntegration.test.ts`, `readerActionFlow.test.ts` | Reader popup/context menu smoke |
| No current PDF | `contextAssembler.test.ts`, `scopeResolver.test.ts` | Reader no-PDF or unloaded-PDF smoke |
| Context wrong after switching PDF tabs | `scopeResolver.test.ts`, `chatSession.test.ts` | two PDF tab switch smoke |
| Export empty or long conversation | `threadExport.test.ts` | Save dialog and exported file check |
| Chinese/special title export | filename helper test | real file save on macOS |
| Settings save failure | `preferencesPane.test.ts`, `settingsManager.test.ts` | Settings save/reopen/restart |
| Network failure | `chatSession.test.ts`, provider tests | provider error visible in sidebar |
| Streaming interrupted | `chatSession.test.ts`, provider SSE tests | stop button and interrupted stream smoke |

---

## Completion Rule

This board is not complete until:

- P0 debug log utility and export path are implemented.
- Issue reports can include a debug JSONL file.
- At least one packaged XPI smoke run proves Settings debug export and Reader handoff traces in real Zotero.
- Follow-up issues exist for any P1/P2 gaps that remain.
