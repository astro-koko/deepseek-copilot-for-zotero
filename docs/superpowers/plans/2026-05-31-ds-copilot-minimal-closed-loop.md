# Deepseek Copliot Minimal Closed-Loop Implementation Plan

## Status: superseded as the immediate execution baseline

This plan still contains useful implementation details, but it is no longer the current top-level execution guide.

Use these documents first for active execution:

- [2026-05-31-ds-copilot-host-first-frontend-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [2026-05-31-ds-copilot-host-first-frontend-task-board.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

Current interpretation:

- the host-first frontend gate comes before provider-complete acceptance
- daily-profile host stability is the current formal target
- packaged `.xpi` plus full restart remains the release-style gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the built `.xpi` install cleanly in Zotero and deliver a stable minimal DeepSeek chat loop: Library sidebar shows, Reader entry points show, and at least one real DeepSeek round-trip succeeds after importing the packaged plugin through Zotero's plugin manager.

**Architecture:** Keep the current project as the primary base. Fix the runtime in the same order Zotero experiences it: packaged addon startup, sidebar registration and mounting, Reader action handoff, then the DeepSeek request/streaming path. Use Beaver only as a behavior reference for interaction orchestration, not as a source tree to transplant wholesale.

**Tech Stack:** `zotero-plugin-scaffold`, TypeScript, React 18, `zotero-plugin-toolkit`, Vitest, Zotero XUL APIs, DeepSeek OpenAI-compatible API.

---

## Reference Anchors

Use these files as the first references before changing behavior:

- Current project startup chain:
  - `addon/bootstrap.js`
  - `src/index.ts`
  - `src/addon.ts`
  - `src/hooks.ts`
  - `zotero-plugin.config.ts`
- Current project sidebar/runtime chain:
  - `src/ui/ui.ts`
  - `src/ui/sidebarSection.ts`
  - `src/ui/components/Sidebar.tsx`
  - `src/ui/components/Composer.tsx`
  - `src/utils/windowLifecycle.ts`
- Current project Reader and chat chain:
  - `src/modules/readerIntegration.ts`
  - `src/services/chatSession.ts`
  - `src/services/chatEngine.ts`
  - `src/services/provider/openAICompatibleProvider.ts`
  - `src/services/settingsManager.ts`
- Current project smoke references:
  - `docs/zotero-dev-smoke-checklist.md`
  - `docs/zotero-sidebar-stability-review.md`
- Beaver behavior references:
  - `reference/beaver-zotero-v0.20.0-beta.1/addon/bootstrap.js`
  - `reference/beaver-zotero-v0.20.0-beta.1/src/hooks.ts`
  - `reference/beaver-zotero-v0.20.0-beta.1/src/modules/readerIntegration.ts`
  - `reference/beaver-zotero-v0.20.0-beta.1/react/hooks/useReaderSelectionActionHandler.ts`
  - `reference/beaver-zotero-v0.20.0-beta.1/react/hooks/useContextMenuActionHandler.ts`
  - `reference/beaver-zotero-v0.20.0-beta.1/react/components/LibrarySidebar.tsx`
  - `reference/beaver-zotero-v0.20.0-beta.1/react/components/ReaderSidebar.tsx`

## Known Current Risks

Treat these as pre-confirmed leads unless implementation disproves them:

1. `Reader` actions currently dispatch `readerSelectionAction`, but `src/ui/components/Sidebar.tsx` only subscribes to `scopeChange`. That means Reader popup/menu actions can appear without actually opening a useful conversation flow.
2. `src/services/provider/openAICompatibleProvider.ts` parses SSE chunks line-by-line without buffering partial frames. DeepSeek streaming responses can split JSON across chunks, which can cause blank or truncated assistant output in real use even if tests and build succeed.
3. Current docs already distinguish dev proxy mode from packaged install, but there is no automated build-artifact verification step that forces the team to validate the shipped `.xpi` path first.

### Task 1: Lock the XPI-First Acceptance Gate

**Files:**
- Create: `scripts/verify-build-artifact.mjs`
- Modify: `package.json`
- Modify: `docs/zotero-dev-smoke-checklist.md`
- Modify: `docs/zotero-sidebar-stability-review.md`

- [ ] **Step 1: Add a build-artifact verification script**

Create `scripts/verify-build-artifact.mjs` to fail fast when the packaged addon is incomplete:

```js
import fs from "node:fs";
import path from "node:path";
import pkg from "../package.json" with { type: "json" };

const buildRoot = path.resolve(".scaffold/build");
const required = [
  path.join(buildRoot, `${pkg.config.addonName}-${pkg.version}.xpi`),
  path.join(buildRoot, "addon/bootstrap.js"),
  path.join(buildRoot, "addon/manifest.json"),
  path.join(buildRoot, "addon/prefs.js"),
  path.join(buildRoot, "addon/content/preferences.xhtml"),
  path.join(buildRoot, `addon/content/scripts/${pkg.config.addonRef}.js`),
];

const missing = required.filter((file) => !fs.existsSync(file));

if (missing.length > 0) {
  console.error("Missing packaged addon artifacts:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Packaged addon artifacts verified.");
```

- [ ] **Step 2: Expose the verification command in `package.json`**

Add a script that becomes part of the required pre-install checklist:

```json
{
  "scripts": {
    "verify:xpi": "node scripts/verify-build-artifact.mjs"
  }
}
```

- [ ] **Step 3: Run the packaged build gate**

Run:

```bash
npm run build
npm run verify:xpi
```

Expected:

```text
✔ Build finished
Packaged addon artifacts verified.
```

- [ ] **Step 4: Rewrite the smoke docs so packaged install is the only real acceptance gate**

In `docs/zotero-dev-smoke-checklist.md` and `docs/zotero-sidebar-stability-review.md`, make these rules explicit:

```md
- `npm start` is only for rapid iteration.
- A change is not accepted until the built `.xpi` is imported through Zotero's plugin manager.
- If the plugin is missing from the Add-ons list after `.xpi` install, stop and debug startup/install only.
- If the plugin is listed but the sidebar is missing, debug registration/mounting before touching DeepSeek code.
```

- [ ] **Step 5: Commit the acceptance-gate changes**

```bash
git add package.json scripts/verify-build-artifact.mjs docs/zotero-dev-smoke-checklist.md docs/zotero-sidebar-stability-review.md
git commit -m "chore: add xpi-first verification gate"
```

### Task 2: Make Startup and Registration Failures Observable

**Files:**
- Modify: `src/utils/startupDiagnostics.ts`
- Modify: `src/utils/startupDiagnostics.test.ts`
- Modify: `src/hooks.ts`
- Modify: `src/utils/ztoolkit.ts`

- [ ] **Step 1: Write the failing diagnostics test**

Extend `src/utils/startupDiagnostics.test.ts` with a detail-aware assertion:

```ts
import { describe, expect, it } from "vitest";
import { buildStartupDiagnostic } from "./startupDiagnostics";

describe("buildStartupDiagnostic", () => {
  it("includes stage and detail when provided", () => {
    expect(
      buildStartupDiagnostic({
        addonID: "zotero-ai-assistant@agentpaper.dev",
        version: "0.1.0",
        stage: "sidebar-registration-failed",
        detail: "No Zotero window was available",
      }),
    ).toContain("sidebar-registration-failed :: No Zotero window was available");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails first**

Run:

```bash
npx vitest run src/utils/startupDiagnostics.test.ts
```

Expected: one failing assertion because `detail` is not yet formatted.

- [ ] **Step 3: Implement structured startup diagnostics**

Update `src/utils/startupDiagnostics.ts` so every critical startup stage can carry a human-readable detail:

```ts
interface StartupDiagnosticArgs {
  addonID: string;
  stage: string;
  version: string;
  detail?: string;
}

export function buildStartupDiagnostic({
  addonID,
  stage,
  version,
  detail,
}: StartupDiagnosticArgs): string {
  return `[${addonID} v${version}] ${stage}${detail ? ` :: ${detail}` : ""}`;
}
```

Then use it in `src/hooks.ts` around these checkpoints:

```ts
ztoolkit.log(buildStartupDiagnostic({ addonID: config.addonID, version, stage: "startup" }));
ztoolkit.log(buildStartupDiagnostic({ addonID: config.addonID, version, stage: "main-window-load" }));
ztoolkit.log(buildStartupDiagnostic({ addonID: config.addonID, version, stage: "sidebar-registered" }));
ztoolkit.log(buildStartupDiagnostic({
  addonID: config.addonID,
  version,
  stage: "sidebar-registration-failed",
  detail: error instanceof Error ? error.message : String(error),
}));
```

Keep production logging enabled for startup failures by updating `src/utils/ztoolkit.ts` so startup diagnostics are not silently suppressed in packaged installs.

- [ ] **Step 4: Re-run the focused test**

Run:

```bash
npx vitest run src/utils/startupDiagnostics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Manual packaged-install observation**

After a fresh build and import, capture the first matching startup lines from Zotero's error console. The expected clean sequence is:

```text
[zotero-ai-assistant@agentpaper.dev v0.1.0] startup
[zotero-ai-assistant@agentpaper.dev v0.1.0] main-window-load
[zotero-ai-assistant@agentpaper.dev v0.1.0] sidebar-registered
[zotero-ai-assistant@agentpaper.dev v0.1.0] ui-ready
readerIntegration: Registered reader event listeners
```

- [ ] **Step 6: Commit the diagnostics work**

```bash
git add src/utils/startupDiagnostics.ts src/utils/startupDiagnostics.test.ts src/hooks.ts src/utils/ztoolkit.ts
git commit -m "chore: add observable startup diagnostics"
```

### Task 3: Stabilize Sidebar Registration and Mounting for Library and Reader

**Files:**
- Modify: `src/ui/ui.ts`
- Modify: `src/ui/sidebarSection.ts`
- Modify: `src/ui/sidebarSection.test.ts`
- Modify: `src/ui/components/Sidebar.tsx`

- [ ] **Step 1: Add failing sidebar host tests for fallback and host reuse**

Extend `src/ui/sidebarSection.test.ts` to lock these invariants:

```ts
it("keeps separate hosts for library and reader surfaces", () => {
  const state = {};
  const first = syncSidebarHost(fakeWindow, state, "library", fakeBody).hostState;
  const second = syncSidebarHost(fakeWindow, state, "reader", fakeBody).hostState;
  expect(first).not.toBe(second);
});

it("reuses the same host for the same surface instead of remounting", () => {
  const state = {};
  const first = syncSidebarHost(fakeWindow, state, "library", fakeBody).hostState;
  const second = syncSidebarHost(fakeWindow, state, "library", fakeBody).hostState;
  expect(first).toBe(second);
});
```

Add one more assertion for library fallback behavior when no item is selected:

```ts
it("attaches a library fallback host without blanking the mount point", () => {
  const host = createFallbackSidebarHost("library", fakeDocument);
  const attached = attachSidebarHostToLibraryFallback(fakeMessagePane, host);
  expect(attached).toBe(true);
  expect(host.attachmentTarget).toBe("library-fallback");
});
```

- [ ] **Step 2: Run the focused sidebar tests**

Run:

```bash
npx vitest run src/ui/sidebarSection.test.ts
```

Expected: fail first if any new invariant is not currently guaranteed.

- [ ] **Step 3: Refactor `UIFactory` around deterministic host ownership**

In `src/ui/ui.ts` and `src/ui/sidebarSection.ts`, keep these rules explicit:

```ts
// One window owns one library host and one reader host.
// Fallback attachment can move the host, but must not create duplicates.
// A bootstrap failure must render a visible error card, never an empty body.
```

Specific implementation targets:

- keep `windowHosts` as the single source of truth
- never create a fresh host if a surface host already exists for that window
- keep `library` and `reader` hosts separate even when moving between official and fallback containers
- if `onRender` or `onAsyncRender` fails, render `SectionErrorCard` instead of leaving the pane empty

Use Beaver's `src/hooks.ts`, `react/components/LibrarySidebar.tsx`, and `react/components/ReaderSidebar.tsx` only as behavior references for "surface-aware sidebars", not as a code transplant.

- [ ] **Step 4: Re-run the sidebar tests and the full suite**

Run:

```bash
npx vitest run src/ui/sidebarSection.test.ts
npm test
```

Expected:

```text
PASS src/ui/sidebarSection.test.ts
Test Files  ... passed
Tests       ... passed
```

- [ ] **Step 5: Manual Library/Reader smoke after packaged install**

In Zotero after importing the built `.xpi`:

1. open the main library view with no selected item
2. verify the Deepseek Copliot section still shows a stable shell instead of disappearing
3. select a real item and verify the same section remains usable
4. open a PDF Reader tab and verify a second surface appears there without duplicating the Library host

- [ ] **Step 6: Commit the sidebar stabilization**

```bash
git add src/ui/ui.ts src/ui/sidebarSection.ts src/ui/sidebarSection.test.ts src/ui/components/Sidebar.tsx
git commit -m "fix: stabilize zotero sidebar registration"
```

### Task 4: Wire Reader Popup/Menu Actions Into the Sidebar Conversation Flow

**Files:**
- Create: `src/ui/readerActionFlow.ts`
- Create: `src/ui/readerActionFlow.test.ts`
- Modify: `src/modules/readerIntegration.ts`
- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/components/Composer.tsx`

- [ ] **Step 1: Add a failing test for Reader action prompt construction**

Create `src/ui/readerActionFlow.test.ts` with explicit expectations for `explain` and `ask`:

```ts
import { describe, expect, it } from "vitest";
import { buildReaderActionDraft } from "./readerActionFlow";

describe("buildReaderActionDraft", () => {
  it("builds an auto-send explain prompt from selected text", () => {
    expect(
      buildReaderActionDraft({
        action: "explain",
        text: "This is the highlighted paragraph.",
        page: 7,
      }),
    ).toContain("Explain the following excerpt from page 7");
  });

  it("builds a prefilled ask prompt from selected text", () => {
    expect(
      buildReaderActionDraft({
        action: "ask",
        text: "This is the highlighted paragraph.",
        page: 7,
      }),
    ).toContain("Question:");
  });
});
```

- [ ] **Step 2: Run the new Reader-flow test and confirm it fails**

Run:

```bash
npx vitest run src/ui/readerActionFlow.test.ts
```

Expected: file missing or function missing.

- [ ] **Step 3: Implement a pure Reader action flow helper**

Create `src/ui/readerActionFlow.ts` modeled after Beaver's `useReaderSelectionActionHandler.ts` and `useContextMenuActionHandler.ts`, but scoped to the local-only plugin:

```ts
export interface ReaderActionDetail {
  action: "explain" | "ask";
  text: string;
  page: number;
  readerItemID: number;
}

export function buildReaderActionDraft(detail: Pick<ReaderActionDetail, "action" | "text" | "page">): string {
  const quoted = `"""${detail.text.trim()}"""`;
  if (detail.action === "explain") {
    return `Explain the following excerpt from page ${detail.page} in clear research language:\n\n${quoted}`;
  }
  return `I am reading page ${detail.page}. Based on this excerpt, help me think through it.\n\n${quoted}\n\nQuestion: `;
}
```

- [ ] **Step 4: Connect the Reader event to the actual sidebar state**

Update `src/ui/components/Sidebar.tsx` so it subscribes to `readerSelectionAction` in addition to `scopeChange`.

Use this flow:

```ts
useEffect(() => {
  const handleReaderSelectionAction = async (event: Event) => {
    const detail = (event as CustomEvent).detail as ReaderActionDetail;
    const prompt = buildReaderActionDraft(detail);
    const currentScope = getCurrentScope();
    setScope(currentScope);
    setContextSummary(summarizeScope(currentScope));

    if (detail.action === "explain") {
      await chatSessionStore.newThread(currentScope || undefined);
      await chatSessionStore.send(prompt, currentScope || undefined);
      return;
    }

    setComposerDraft(prompt);
    setComposerFocusNonce((value) => value + 1);
  };

  eventBus.addEventListener("readerSelectionAction", handleReaderSelectionAction);
  return () => eventBus.removeEventListener("readerSelectionAction", handleReaderSelectionAction);
}, [eventBus]);
```

Then update `src/ui/components/Composer.tsx` to support controlled draft injection and focus:

```ts
interface ComposerProps {
  draftValue?: string;
  focusNonce?: number;
  onDraftChange?: (value: string) => void;
}
```

With a focus effect:

```ts
useEffect(() => {
  inputRef.current?.focus();
}, [focusNonce]);
```

- [ ] **Step 5: Re-run Reader-flow and full tests**

Run:

```bash
npx vitest run src/ui/readerActionFlow.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 6: Manual Reader smoke after packaged install**

In Zotero:

1. open a real PDF
2. select text
3. confirm the popup shows `Explain` and `Ask...`
4. click `Explain` and verify a new thread is created and a response starts streaming
5. click `Ask...` and verify the sidebar composer is focused with a prefilled draft instead of doing nothing

- [ ] **Step 7: Commit the Reader action flow**

```bash
git add src/ui/readerActionFlow.ts src/ui/readerActionFlow.test.ts src/modules/readerIntegration.ts src/ui/components/Sidebar.tsx src/ui/components/Composer.tsx
git commit -m "feat: connect reader actions to sidebar chat flow"
```

### Task 5: Make DeepSeek Streaming and Settings Robust Enough for Real Use

**Files:**
- Create: `src/services/provider/openAICompatibleProvider.test.ts`
- Modify: `src/services/provider/openAICompatibleProvider.ts`
- Modify: `src/services/chatEngine.test.ts`
- Modify: `src/services/settingsManager.ts`
- Modify: `src/services/settingsManager.test.ts`
- Modify: `addon/prefs.js`
- Modify: `addon/content/preferences.xhtml`

- [ ] **Step 1: Add a failing SSE chunk-boundary test**

Create `src/services/provider/openAICompatibleProvider.test.ts` with a split-frame streaming case:

```ts
import { describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleProvider } from "./openAICompatibleProvider";

describe("openAICompatibleProvider", () => {
  it("reassembles SSE frames that are split across chunks", async () => {
    const chunks = [
      new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hel'),
      new TextEncoder().encode('lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n'),
    ];

    globalThis.fetch = vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }))) as any;

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    const response = await provider.sendChat([{ role: "user", content: "hi" }]);
    let text = "";
    for await (const chunk of response.stream) text += chunk;
    expect(text).toBe("Hello world");
  });
});
```

- [ ] **Step 2: Run the provider test and confirm it fails**

Run:

```bash
npx vitest run src/services/provider/openAICompatibleProvider.test.ts
```

Expected: fail because the current parser drops partial JSON frames.

- [ ] **Step 3: Replace the line-splitting parser with a buffered SSE parser**

Update `src/services/provider/openAICompatibleProvider.ts` to keep an incremental buffer:

```ts
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const frames = buffer.split("\n");
  buffer = frames.pop() ?? "";

  for (const rawLine of frames) {
    const line = rawLine.trim();
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    if (data === "[DONE]") return;
    const parsed = JSON.parse(data);
    const delta = parsed.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
```

Also preserve provider error bodies:

```ts
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Provider error ${response.status}: ${errorText}`);
}
```

- [ ] **Step 4: Tighten settings validation and packaged defaults**

In `src/services/settingsManager.ts`, keep the plugin strict and local-only:

```ts
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;
```

Make sure `getSettingsIssue()` remains the gate that disables the composer until an API key exists.

In `addon/prefs.js` and `addon/content/preferences.xhtml`, keep only the DeepSeek-facing fields:

```js
pref("extensions.zotero.zotero-ai-assistant.apiKey", "");
pref("extensions.zotero.zotero-ai-assistant.model", "deepseek-v4-flash");
pref("extensions.zotero.zotero-ai-assistant.maxContextBudget", 4000);
```

Do not add account/profile/credits fields.

- [ ] **Step 5: Re-run focused provider/settings tests and the full suite**

Run:

```bash
npx vitest run src/services/provider/openAICompatibleProvider.test.ts
npx vitest run src/services/settingsManager.test.ts src/services/chatEngine.test.ts
npm test
```

Expected: all pass.

- [ ] **Step 6: Manual DeepSeek round-trip smoke**

After importing the built `.xpi` into Zotero:

1. open Zotero Settings
2. enter a real DeepSeek API key
3. select `deepseek-v4-flash`
4. open the Deepseek Copliot sidebar on a real item
5. send `Summarize the current paper in 5 bullets.`
6. verify `AI is responding` appears and completes with a persisted assistant message

- [ ] **Step 7: Commit the provider-hardening work**

```bash
git add src/services/provider/openAICompatibleProvider.test.ts src/services/provider/openAICompatibleProvider.ts src/services/chatEngine.test.ts src/services/settingsManager.ts src/services/settingsManager.test.ts addon/prefs.js addon/content/preferences.xhtml
git commit -m "fix: harden deepseek streaming and settings flow"
```

### Task 6: Run the Final Packaged-Install Smoke and Freeze the Working Baseline

**Files:**
- Modify: `docs/zotero-dev-smoke-checklist.md`
- Modify: `docs/zotero-sidebar-stability-review.md`
- Optional Modify: `IMPLEMENTATION_PLAN.md` if the project keeps a top-level status log

- [ ] **Step 1: Run the exact final verification commands**

Run:

```bash
npm test
npm run build
npm run verify:xpi
```

Expected:

```text
Test Files  ... passed
Tests       ... passed
✔ Build finished
Packaged addon artifacts verified.
```

- [ ] **Step 2: Install the packaged addon through Zotero's plugin manager**

Use this exact artifact:

```text
.scaffold/build/Deepseek Copliot-0.1.0.xpi
```

Do not validate by copying files into `extensions/` and do not rely on `npm start` for the final pass.

- [ ] **Step 3: Pass the six packaged-install smoke gates**

All six must pass in the same Zotero profile:

1. `Deepseek Copliot` appears in Zotero Add-ons.
2. `Deepseek Copliot` Preferences pane opens and saves a real API key.
3. Library sidebar section appears with no selected item and with a selected item.
4. PDF Reader popup and context-menu entries appear for selected text.
5. `Explain` triggers a real DeepSeek streaming response.
6. Restart Zotero and confirm the plugin, sidebar, and Reader entry points still work.

- [ ] **Step 4: Record the known-good baseline in the docs**

Append a short section like this to both smoke docs:

```md
## Known-Good Baseline

- Verified artifact: `.scaffold/build/Deepseek Copliot-0.1.0.xpi`
- Verified on: Zotero plugin manager import
- Verified features:
  - Add-ons listing
  - Preferences pane
  - Library sidebar
  - Reader popup and menu
  - One real DeepSeek response
```

- [ ] **Step 5: Commit the frozen baseline**

```bash
git add docs/zotero-dev-smoke-checklist.md docs/zotero-sidebar-stability-review.md IMPLEMENTATION_PLAN.md
git commit -m "docs: record packaged zotero smoke baseline"
```

## Execution Notes

- Do not start with Beaver code transplanting.
- Do not add any account, profile, billing, cloud thread, or credits concepts.
- If the packaged addon is missing from the Add-ons list, stop at Task 2 and debug startup only.
- If the sidebar is visible but Reader actions do nothing, stop at Task 4 and debug the `readerSelectionAction` subscription only.
- If the UI is present but replies are blank or partial, stop at Task 5 and debug the streaming parser before touching scope/context logic.
- Once this plan passes, the next plan can safely cover Beaver-like polish such as richer thread lists, stronger scope chips, and a more Beaver-like shell.
