# Deepseek Copliot Native Sidebar Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Deepseek Copliot appear as a proper Zotero right-side sidebar entry instead of a top toolbar fallback, and prove the native host is stable in Library and Reader.

**Architecture:** Keep the existing React sidebar host and native pane mount points, but change surface ownership so `Zotero.ItemPaneManager` right-side navigation is the primary entry. Remove the temporary top-toolbar toggle path, preserve native host mounting in `#zotero-item-pane` and `#zotero-context-pane-inner`, and validate the result with packaged-Zotero smoke evidence.

**Tech Stack:** TypeScript, React, Vitest, Zotero Plugin Toolkit, Zotero `ItemPaneManager`

---

## File Map

- Modify: [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)
  - Owns Deepseek Copliot surface registration, native pane mounting, visibility control, and diagnostic output.
- Modify: [src/ui/ui.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.test.ts)
  - Covers surface registration contracts, stale mount cleanup, and visibility behavior.
- Modify: [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
  - Must stop describing the top-toolbar toggle as part of the active loop and add explicit native-sidebar acceptance notes.
- Modify: [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
  - Keeps the host debugging order aligned with the new section-first surface contract.

### Task 1: Lock The Correct Surface Contract In Tests

**Files:**
- Modify: [src/ui/ui.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.test.ts)
- Test: [src/ui/ui.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.test.ts)

- [ ] **Step 1: Write the failing test for section-first registration**

Add a test that proves:
- `registerSection()` uses `sidenav`
- no top toolbar toggle is created
- the section remains the visible entry contract even when a native pane exists

Use assertions shaped like:

```ts
expect(sectionConfig.header).toBeUndefined();
expect(
  win.document.getElementById("zotero-ai-assistant-tb-chat-toggle"),
).toBeNull();
expect(setEnabled).toHaveBeenCalledWith(false);
```

- [ ] **Step 2: Run the focused UI test and verify it fails**

Run:

```bash
npm test -- src/ui/ui.test.ts
```

Expected:
- one or more failures proving `header` and the toolbar toggle still exist

- [ ] **Step 3: Update existing UI tests that still assume the toolbar button exists**

Remove stale assertions like:

```ts
expect(toolbar.children.some((child) => child.id === "zotero-ai-assistant-tb-chat-toggle")).toBe(true);
expect(parsed.nodes.toggleButton?.ariaPressed).toBe("true");
```

Replace them with native-host-only expectations like:

```ts
expect(parsed.nodes.libraryMount).toBeTruthy();
expect(parsed.nodes.readerMount).toBeTruthy();
expect(
  win.document.getElementById("zotero-ai-assistant-tb-chat-toggle"),
).toBeNull();
```

- [ ] **Step 4: Re-run the focused UI test and verify it is still red for production behavior only**

Run:

```bash
npm test -- src/ui/ui.test.ts
```

Expected:
- failures now come from production code still creating the toolbar path, not from stale test assumptions

- [ ] **Step 5: Commit the test-contract change**

```bash
git add src/ui/ui.test.ts
git commit -m "test: lock native sidebar surface contract"
```

### Task 2: Remove The Toolbar Fallback And Promote The Right-Side Section

**Files:**
- Modify: [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)
- Test: [src/ui/ui.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.test.ts)

- [ ] **Step 1: Remove the top-toolbar registration path from `registerChatPanel()` and `refreshWindow()`**

Delete the toolbar-specific calls:

```ts
this.removeToolbarButton(win);
this.ensureToolbarButton(win);
this.syncToolbarState(win, visible);
```

Keep the native host flow:

```ts
this.attachNativeHost(win, "library");
this.attachNativeHost(win, "reader");
this.applyPaneVisibility(win, "library", visible && selectedType === "library");
this.applyPaneVisibility(win, "reader", visible && selectedType === "reader");
```

- [ ] **Step 2: Remove the `header` registration from `ItemPaneManager.registerSection()`**

Keep only:

```ts
sidenav: {
  l10nID: getLocaleID("ai-assistant-sidebar-title"),
  icon: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
},
```

Delete:

```ts
header: {
  l10nID: getLocaleID("ai-assistant-sidebar-title"),
  icon: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
},
```

- [ ] **Step 3: Delete the toolbar-only helper chain**

Remove these functions and their constants/imports:

```ts
ensureToolbarButton
removeToolbarButton
syncToolbarState
announceSidebarState
ensureLiveRegion
TOGGLE_BUTTON_ID
TOGGLE_SEPARATOR_ID
LIVE_REGION_ID
getPref
setSidebarVisible
ToolbarButtonLike
```

Also remove diagnostic collection of:

```ts
toggleButton: summarizeNode(TOGGLE_BUTTON_ID),
```

- [ ] **Step 4: Run the focused UI test and verify it passes**

Run:

```bash
npm test -- src/ui/ui.test.ts
```

Expected:
- all UI surface tests pass

- [ ] **Step 5: Commit the surface ownership fix**

```bash
git add src/ui/ui.ts src/ui/ui.test.ts
git commit -m "fix: use native Zotero sidebar section as primary surface"
```

### Task 3: Regress Native Host Helpers And Cleanup Behavior

**Files:**
- Test: [src/ui/sidebarSection.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/sidebarSection.test.ts)
- Test: [src/ui/sidebarRuntime.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/sidebarRuntime.test.ts)
- Test: [src/modules/preferencesPane.test.ts](/Users/Liang/project/agentpaper_zotero/src/modules/preferencesPane.test.ts)

- [ ] **Step 1: Run the host-adjacent regression suite**

Run:

```bash
npm test -- src/ui/ui.test.ts src/ui/sidebarSection.test.ts src/ui/sidebarRuntime.test.ts src/modules/preferencesPane.test.ts
```

Expected:
- all tests pass

- [ ] **Step 2: If any regression fails, make the smallest host-only correction**

Allowed corrections:
- native pane visibility restore logic
- stale mount cleanup logic
- section enablement checks

Do not reintroduce the toolbar button to make tests pass.

- [ ] **Step 3: Re-run the same suite and verify it is green**

Run:

```bash
npm test -- src/ui/ui.test.ts src/ui/sidebarSection.test.ts src/ui/sidebarRuntime.test.ts src/modules/preferencesPane.test.ts
```

Expected:
- 100% pass

- [ ] **Step 4: Commit the regression-safe cleanup**

```bash
git add src/ui/ui.ts src/ui/ui.test.ts
git commit -m "test: cover native sidebar host regressions"
```

### Task 4: Update The Smoke Contract And Debugging Docs

**Files:**
- Modify: [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- Modify: [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)

- [ ] **Step 1: Remove stale top-toolbar language from the smoke checklist**

Replace lines that treat toolbar-only discovery as active fallback guidance with language like:

```md
- top-toolbar discovery is a regression and should be treated as a surface failure.
- the acceptance surface is the native right-side Zotero pane entry in Library and Reader.
```

- [ ] **Step 2: Tighten the host-loop acceptance text in the workbench**

Update the fixed triage and loop wording so it explicitly expects:

```md
3. Library native host exists and is visibly correct through the right-side pane entry
4. Reader native host exists and is visibly correct through the right-side pane entry
```

- [ ] **Step 3: Verify doc edits are consistent with current implementation**

Read both docs back and confirm they no longer tell engineers to rely on the toolbar surface.

- [ ] **Step 4: Commit the documentation alignment**

```bash
git add docs/zotero-dev-smoke-checklist.md docs/zotero-dev-workbench.md
git commit -m "docs: align smoke guidance with native sidebar surface"
```

### Task 5: Real Zotero Host Smoke In Packaged Mode

**Files:**
- Verify only: [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- Verify only: [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)

- [ ] **Step 1: Run the packaged preflight**

Run:

```bash
npm run check
```

Expected:
- tests pass
- build succeeds
- packaged artifact verification succeeds

- [ ] **Step 2: Install the built `.xpi` into Zotero and verify native placement**

Manual smoke in Zotero:
1. Open `Tools -> Plugins`
2. Install the built `.xpi`
3. Restart Zotero
4. Select one regular library item
5. Confirm Deepseek Copliot appears in the right-side pane entry, not as a top `D...` toolbar fragment
6. Open one PDF reader tab
7. Confirm the same right-side pane entry exists and opens the Reader host

Expected:
- no top truncated `D...` entry
- right-side native pane entry visible in both Library and Reader

- [ ] **Step 3: Verify Reader handoff still reaches the native host**

Manual smoke:
1. Select text in a PDF
2. Click `Explain`
3. Confirm the right-side Deepseek Copliot pane becomes the active surface
4. Trigger `Ask...`
5. Confirm draft prefill lands in the same native pane host

Expected:
- no fallback error card
- no toolbar-only path needed

- [ ] **Step 4: Capture runtime evidence if anything looks wrong**

If the placement still looks off, inspect `/tmp/ds-copilot-surface-state.json` and record:

```json
{
  "selectedType": "reader",
  "nodes": {
    "itemPane": "...",
    "contextPane": "...",
    "contextPaneInner": "...",
    "libraryMount": "...",
    "readerMount": "..."
  }
}
```

Expected:
- mounts are parented to `zotero-item-pane` and `zotero-context-pane-inner`
- no dependency on a toolbar button node

- [ ] **Step 5: Commit only after packaged smoke is clean**

```bash
git add src/ui/ui.ts src/ui/ui.test.ts docs/zotero-dev-smoke-checklist.md docs/zotero-dev-workbench.md
git commit -m "fix: restore ds copilot to the native Zotero sidebar"
```
