# Deepseek Copliot Debug Observability And Regression Workflow Design

Status: Active planning spec
Owner: AgentPaper
Related issue: Debug workflow foundation
Target release: next host-stability release

## Classification

Classification: `task`

Affected Zotero surfaces:

- Add-ons startup and lifecycle
- Settings pane
- Library right-side pane
- Reader right-side pane
- Reader popup and context menu
- Provider request path
- Local persistence
- Conversation export
- Packaged XPI smoke

## Problem

Deepseek Copliot already has a real Zotero-native implementation, but user reports still arrive as symptoms:

- a button cannot be clicked
- selected Reader text does nothing
- export fails
- context is stale after switching items or PDF tabs
- the sidebar disappears
- settings do not persist
- behavior differs across Zotero versions or systems

The current codebase has useful local diagnostics, including startup messages and `__aiAssistantDiagnostics`, but those signals are scattered and not enough to reconstruct a failed user workflow. A report should let maintainers answer:

- did the user click the button?
- was the button disabled, blocked by missing scope, or did the handler fail?
- did the Reader action reach the sidebar event bus?
- which Zotero API call failed?
- did settings save to prefs and reload?
- did export fail at picker, path normalization, or file write?
- did the provider request start, stream, abort, or return an error?

## Goals

- Add a small structured debug log system that works inside Zotero Desktop.
- Keep logging privacy-safe by default.
- Make every major user workflow traceable by event, surface, and trace id.
- Add a one-click debug log export path for user issue reports.
- Keep tests layered so pure UI, Node logic, mocked Zotero API, and real Zotero smoke each cover the correct boundary.
- Turn recurring user symptoms into Issue -> Test -> Fix workflows.

## Non-goals

- Do not introduce a remote telemetry service.
- Do not upload logs automatically.
- Do not log API keys, full PDF text, full selected text, full prompts, cookies, profile paths, Zotero databases, or thread histories.
- Do not replace packaged XPI smoke with browser automation.
- Do not make Playwright or Storybook the acceptance gate for Zotero host behavior.
- Do not broaden provider or agent-platform features while host acceptance is still unstable.

## User Workflow

For users:

1. Reproduce the issue in Zotero.
2. Open Deepseek Copliot Settings or the sidebar action menu.
3. Click `Export Debug Log`.
4. Attach the exported JSONL file and the issue template fields.

For maintainers:

1. Classify the issue layer: install, settings, Library host, Reader host, Reader handoff, provider, export, persistence, or restart.
2. Search the debug log by `traceId` or event sequence.
3. Add or update the smallest meaningful automated test for that layer.
4. Implement the fix in the matching lane.
5. Run the focused test, then the broader gate.
6. For host or Reader changes, build a dev XPI and collect real Zotero smoke evidence.

## Scope And Boundaries

### In Scope

- A new local logging helper under `src/utils`.
- Instrumentation at user-action and Zotero-boundary points.
- Debug log export from Settings and optionally the sidebar.
- Issue template updates for structured triage.
- Task-board updates that map symptoms to tests and real Zotero evidence.

### Out Of Scope

- Full observability platform.
- Network telemetry.
- Large UI redesign.
- Replacing existing persistence.
- Copying another Zotero plugin's architecture wholesale.

## Design Decisions

### Structured Local Log

Add a ring-buffer logger that records normalized events:

```ts
{
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  surface?: "startup" | "settings" | "library" | "reader" | "sidebar" | "provider" | "export" | "persistence";
  action?: string;
  traceId?: string;
  scopeType?: string;
  scopeId?: string;
  itemIdsCount?: number;
  readerItemID?: number;
  page?: number;
  selectedTextChars?: number;
  messageChars?: number;
  model?: string;
  status?: string;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
}
```

The logger must support:

- `debugLog.info(event, fields)`
- `debugLog.warn(event, fields)`
- `debugLog.error(event, error, fields)`
- `createTraceId(prefix)`
- `exportDebugLog(path)`
- `clearDebugLog()`
- `getDebugLogSnapshot()`

### Privacy Guardrails

Log only metadata:

- text lengths
- booleans such as `hasApiKey`
- model name
- status code
- scope type and stable scope id
- short error message

Never log:

- API key values
- Authorization headers
- selected text content
- full prompts
- full provider responses
- full PDF text
- local profile paths
- Zotero DB paths
- cookies

### Event Chain Examples

Button cannot be clicked:

```text
ui.button.render
ui.button.click
chat.send.blocked
```

Reader selection has no reaction:

```text
reader.popup.render
reader.action.dispatch
sidebar.readerAction.received
chat.send.start
```

Export failure:

```text
export.button.click
export.picker.open
export.path.selected
export.file.write.start
export.file.write.error
```

Settings save failure:

```text
settings.pane.load
settings.save.start
settings.prefs.write
settings.save.success | settings.save.error
```

## Files Expected To Change

P0 expected files:

- `src/utils/debugLog.ts`
- `src/utils/debugLog.test.ts`
- `src/modules/readerIntegration.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/components/Sidebar.tsx`
- `src/ui/components/Composer.tsx`
- `src/services/settingsManager.ts`
- `src/modules/preferencesPane.ts`
- `src/services/threadExport.ts`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `docs/zotero-doc-index.md`

P1 expected files:

- `src/services/chatSession.ts`
- `src/services/chatEngine.ts`
- `src/services/provider/openAICompatibleProvider.ts`
- `src/services/contextAssembler.ts`
- `src/services/persistence.ts`
- `src/services/hostSmoke.ts`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-dev-workbench.md`

## Acceptance Criteria

- Every sidebar action button records a click or disabled/block reason.
- Reader popup and context-menu actions record render, disabled state, dispatch, and sidebar receipt.
- Settings load/save/validate records success and failure without leaking keys.
- Export records picker, selected path availability, file-write success, and failure class.
- Provider requests record sanitized request metadata and stream status.
- Debug logs can be exported to JSONL from Zotero.
- Issue templates ask for the exported debug log and triage layer.
- Focused Vitest coverage exists for sanitization, ring-buffer behavior, export formatting, and at least one trace chain.
- Packaged XPI smoke confirms debug export works in real Zotero.

## Verification Plan

Focused tests:

```bash
npm test -- src/utils/debugLog.test.ts
npm test -- src/modules/readerIntegration.test.ts src/ui/readerActionFlow.test.ts
npm test -- src/services/threadExport.test.ts src/modules/preferencesPane.test.ts
```

Broader local gate:

```bash
npm test
npm run build:dev:xpi
```

Packaged artifact gate:

```bash
npm run verify:xpi
```

Release gate when user-visible Settings or host behavior changes:

```bash
npm run build:release:xpi
```

## Real Zotero Smoke

Required after the P0 implementation:

1. Install dev XPI through Zotero Add-ons.
2. Confirm Add-ons entry appears.
3. Open Settings, save a harmless change, export debug log.
4. Select a Library regular item and click sidebar actions.
5. Open a PDF Reader tab, select text, trigger `Explain` and `Ask...`.
6. Export a conversation.
7. Restart Zotero and repeat Settings plus one Reader handoff.

Evidence to record:

- XPI path and hash
- manifest version and version_name
- Zotero version
- profile class: dev or clean release
- debug log JSONL excerpt with secrets absent
- host smoke JSON if configured
- pass/fail by layer

## Reference Adoption

Reference files inspected:

- `reference/beaver-zotero/react/hooks/useReaderSelectionActionHandler.ts`
- `reference/aidea-zotero/doc/ARCHITECTURE_CN.md`
- `reference/llm-for-zotero/src/utils/debugLogger.ts`
- `reference/llm-for-zotero/scripts/check-import-cycles.cjs`
- `reference/llm-for-zotero/src/shared/conversationIntegrity.ts`

Borrow:

- Beaver's staged Reader handoff idea: receive selection action, open/activate sidebar flow, then either auto-send or focus input.
- AIdea's architecture-map pattern: keep a quick file-to-responsibility table for future maintainers.
- llm-for-zotero's lightweight local debug helper and health-gate mindset.

Do not borrow:

- Beaver account, subscription, cloud orchestration, or SaaS assumptions.
- AIdea megafile controller style.
- llm-for-zotero external runtime bridge, agent platform, MinerU, skills portal, or broad conversation schema.

Local verification:

- Vitest for logger and workflow traces.
- Packaged XPI smoke for Zotero surfaces.
- Debug log privacy review before treating exports as shareable.

## Risks And Mitigations

- Risk: logs leak private content.
  - Mitigation: central sanitizer, tests for API-key and content redaction, default metadata-only events.
- Risk: logs become noisy.
  - Mitigation: fixed ring buffer, event names grouped by surface, export only on demand.
- Risk: instrumentation changes behavior.
  - Mitigation: best-effort logging that swallows logger errors.
- Risk: tests over-mock Zotero.
  - Mitigation: real packaged XPI smoke remains the acceptance gate for host and Reader behavior.
- Risk: current dirty worktree causes accidental overlap.
  - Mitigation: implement in small lanes; start with new utility and docs before touching hot files.

## Open Questions

- Should debug export live in both Settings and Sidebar, or Settings only for P0?
- Should exported logs include the last `hostSmoke` report when available?
- Should trace ids be exposed in the UI after failures, or only in exported logs?
- What is the default log retention size after packaged smoke: 500, 1000, or pref-backed?
