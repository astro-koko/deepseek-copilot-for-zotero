# Deepseek Copliot v0.9.1 Native Font Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `v0.9.1` by replacing Deepseek Copliot's hard-coded sidebar typography with Zotero-host inheritance plus a small set of relative text hierarchies that follow `View -> Font Size`.

## Post-Implementation Guardrail

- Native font inheritance only applies to typography and layout rhythm.
- Deepseek Copliot-owned surfaces must keep Deepseek Copliot branding:
  - Add-ons entry icon
  - Preferences pane icon
  - native Library/Reader pane entry icon
  - sidebar header brand mark
- Current product decision:
  - use the existing DeepSeek icon assets already shipped with the plugin
  - do not replace them with custom Deepseek Copliot svg marks unless the user explicitly asks for a rebrand
- Do not replace plugin-owned icons with generic Zotero host icons such as `chrome://zotero/skin/.../note.svg` unless the product decision explicitly changes plugin branding.
- If a real packaged install still shows the old icon after code/package updates, treat `addonStartup.json.lz4` as a cache suspect before reworking the icon code again.

**Architecture:** Keep the current sidebar/component structure intact, but introduce one tiny shared typography helper that expresses semantic relative sizes instead of absolute pixel sizes. Migrate main sidebar surfaces, markdown rendering, popup surfaces, and fallback cards away from fixed `px` sizing and custom app font stacks so the plugin mostly inherits from Zotero's registered UI roots.

**Tech Stack:** TypeScript, React, Vitest, Zotero Plugin Toolkit, Zotero Plugin Scaffold

---

## File Map

- Create: [src/ui/typography.ts](/Users/Liang/project/agentpaper_zotero/src/ui/typography.ts)
- Create: [src/ui/components/NativeTypographySource.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/components/NativeTypographySource.test.ts)
- Modify: [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)
- Modify: [src/ui/components/Composer.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.tsx)
- Modify: [src/ui/components/ThreadView.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ThreadView.tsx)
- Modify: [src/ui/components/EmptyState.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/EmptyState.tsx)
- Modify: [src/ui/components/ScopeBar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ScopeBar.tsx)
- Modify: [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)
- Modify: [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/src/modules/readerIntegration.ts)
- Modify: [addon/content/styles.css](/Users/Liang/project/agentpaper_zotero/addon/content/styles.css)
- Modify: [src/ui/components/Composer.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.test.tsx)
- Modify: [src/ui/components/ThreadView.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ThreadView.test.tsx)
- Modify: [package.json](/Users/Liang/project/agentpaper_zotero/package.json)
- Modify: [package-lock.json](/Users/Liang/project/agentpaper_zotero/package-lock.json)

## Task 1: Lock The Native Typography Contract In Tests

**Files:**
- Create: [src/ui/components/NativeTypographySource.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/components/NativeTypographySource.test.ts)
- Modify: [src/ui/components/Composer.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.test.tsx)
- Modify: [src/ui/components/ThreadView.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ThreadView.test.tsx)

- [ ] **Step 1: Add a failing raw-source contract test for host inheritance**

```ts
import { describe, expect, it } from "vitest";

import sidebarSource from "./Sidebar.tsx?raw";
import emptyStateSource from "./EmptyState.tsx?raw";
import scopeBarSource from "./ScopeBar.tsx?raw";
import uiSource from "../ui.ts?raw";
import readerIntegrationSource from "../../modules/readerIntegration.ts?raw";
import panelStylesSource from "../../../addon/content/styles.css?raw";

describe("Native typography contract", () => {
  it("removes the custom sidebar app font stack and tiny absolute text sizes", () => {
    expect(sidebarSource).not.toContain('"SF Pro Text"');
    expect(emptyStateSource).not.toContain('fontSize: "16px"');
    expect(scopeBarSource).not.toContain('fontSize: "13px"');
  });

  it("lets popup surfaces inherit host font settings", () => {
    expect(panelStylesSource).toContain("font: inherit");
    expect(panelStylesSource).not.toContain("font-size: 12px");
    expect(readerIntegrationSource).not.toContain("font-size: 11px");
  });

  it("keeps fallback cards on relative sizing instead of fixed px text", () => {
    expect(uiSource).not.toContain('fontSize: "14px"');
    expect(uiSource).not.toContain('fontSize: "12px"');
  });
});
```

- [ ] **Step 2: Extend the composer test to expect inherited sizing**

```ts
it("inherits host font sizing instead of hard-coding textarea and control px sizes", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Composer, {
      currentScopeType: "paper",
      isStreaming: false,
      onSend: () => {},
    }),
  );

  expect(markup).toContain("font-family:inherit");
  expect(markup).toContain("font-size:1em");
  expect(markup).toContain("font-size:0.95em");
});
```

- [ ] **Step 3: Extend the thread view test to expect relative heading and table sizing**

```ts
it("renders markdown typography with relative sizing instead of fixed px headings", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      hasScope: true,
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: "# Title\\n\\n| A | B |\\n| - | - |\\n| 1 | 2 |",
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("font-size:1.24em");
  expect(markup).toContain("font-size:0.95em");
  expect(markup).not.toContain("font-size:16px");
});
```

- [ ] **Step 4: Run the focused suite and confirm it fails for the current hard-coded typography**

Run:

```bash
npm test -- src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx src/ui/components/ThreadView.test.tsx
```

Expected:
- FAIL
- assertions showing the old sidebar font stack and `10px/11px/12px/16px` literals are still present

- [ ] **Step 5: Commit the failing test contract**

```bash
git add src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx src/ui/components/ThreadView.test.tsx
git commit -m "test: lock v0.9.1 native typography contract"
```

## Task 2: Introduce Relative Typography And Migrate Main Sidebar Surfaces

**Files:**
- Create: [src/ui/typography.ts](/Users/Liang/project/agentpaper_zotero/src/ui/typography.ts)
- Modify: [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)
- Modify: [src/ui/components/Composer.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.tsx)
- Modify: [src/ui/components/EmptyState.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/EmptyState.tsx)
- Modify: [src/ui/components/ScopeBar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ScopeBar.tsx)

- [ ] **Step 1: Add the tiny shared typography helper**

```ts
export const typography = {
  body: "1em",
  meta: "0.95em",
  label: "0.92em",
  caption: "0.9em",
  headingSm: "1.08em",
  headingMd: "1.16em",
  headingLg: "1.24em",
} as const;
```

- [ ] **Step 2: Remove the sidebar container font stack and convert sidebar labels to semantic relative sizes**

```ts
import { typography } from "../typography";

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "auto",
    background: "#f7f7f7",
    color: "#222",
    minHeight: "0",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  headerTitle: {
    fontSize: typography.headingSm,
    fontWeight: 600,
    lineHeight: 1.25,
  },
  headerMeta: {
    fontSize: typography.meta,
  },
  sectionLabel: {
    fontSize: typography.caption,
    fontWeight: 700,
  },
  scopeLabel: {
    fontSize: typography.body,
    fontWeight: 600,
  },
  listPrimary: {
    fontSize: typography.body,
    fontWeight: 500,
    lineHeight: 1.35,
  },
  listSecondary: {
    fontSize: typography.meta,
    lineHeight: 1.35,
  },
};
```

- [ ] **Step 3: Convert composer text, control labels, and preset copy to host-relative sizes**

```ts
import { typography } from "../typography";

const styles: Record<string, React.CSSProperties> = {
  input: {
    flex: "1 1 180px",
    minWidth: 0,
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #d4d4d4",
    borderRadius: "6px",
    fontSize: typography.body,
    resize: "none",
    minHeight: "56px",
    maxHeight: "140px",
    fontFamily: "inherit",
    background: "#fff",
    color: "#222",
    boxSizing: "border-box",
  },
  modelToggleButton: {
    fontSize: typography.meta,
    fontWeight: 500,
  },
  evidenceButton: {
    fontSize: typography.meta,
    fontWeight: 500,
  },
  presetGroupLabel: {
    fontSize: typography.caption,
    fontWeight: 700,
  },
  presetLabel: {
    fontSize: typography.body,
    fontWeight: 600,
  },
  presetDesc: {
    fontSize: typography.meta,
  },
};
```

- [ ] **Step 4: Convert EmptyState and ScopeBar away from absolute `px` sizes**

```ts
import { typography } from "../typography";

const emptyStateStyles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: typography.headingLg,
    fontWeight: 600,
    marginBottom: "8px",
  },
  description: {
    fontSize: typography.body,
    lineHeight: 1.6,
  },
  kbd: {
    fontFamily: "monospace",
    fontSize: typography.meta,
  },
};

const scopeBarStyles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderBottom: "1px solid #e0e0e0",
    fontSize: typography.body,
    minHeight: "36px",
  },
  chip: {
    fontSize: typography.label,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  count: {
    fontSize: typography.meta,
  },
  selectedText: {
    fontSize: typography.meta,
  },
};
```

- [ ] **Step 5: Re-run the focused tests and verify the sidebar surfaces now satisfy the contract**

Run:

```bash
npm test -- src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx
```

Expected:
- PASS
- source-contract assertions no longer find the old sidebar font stack or the old absolute sidebar/composer sizes

- [ ] **Step 6: Commit the host-inheritance sidebar migration**

```bash
git add src/ui/typography.ts src/ui/components/Sidebar.tsx src/ui/components/Composer.tsx src/ui/components/EmptyState.tsx src/ui/components/ScopeBar.tsx src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx
git commit -m "feat: inherit zotero typography in sidebar surfaces"
```

## Task 3: Migrate Thread Markdown, Popup Surfaces, And Fallback Cards

**Files:**
- Modify: [src/ui/components/ThreadView.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ThreadView.tsx)
- Modify: [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)
- Modify: [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/src/modules/readerIntegration.ts)
- Modify: [addon/content/styles.css](/Users/Liang/project/agentpaper_zotero/addon/content/styles.css)
- Modify: [src/ui/components/ThreadView.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/ThreadView.test.tsx)
- Modify: [src/ui/components/NativeTypographySource.test.ts](/Users/Liang/project/agentpaper_zotero/src/ui/components/NativeTypographySource.test.ts)

- [ ] **Step 1: Convert thread message bubbles and markdown components to relative sizing**

```ts
import { typography } from "../typography";

function buildMarkdownComponents(
  theme: ReturnType<typeof getSidebarTheme>,
): Components {
  return {
    h1: ({ node: _node, children, ...props }) => (
      <h1 {...props} style={{ margin: "0 0 8px", fontSize: typography.headingLg, lineHeight: 1.3 }}>
        {children}
      </h1>
    ),
    h2: ({ node: _node, children, ...props }) => (
      <h2 {...props} style={{ margin: "0 0 7px", fontSize: typography.headingMd, lineHeight: 1.35 }}>
        {children}
      </h2>
    ),
    h3: ({ node: _node, children, ...props }) => (
      <h3 {...props} style={{ margin: "0 0 6px", fontSize: typography.headingSm, lineHeight: 1.35 }}>
        {children}
      </h3>
    ),
    table: ({ node: _node, children, ...props }) => (
      <table {...props} style={{ width: "100%", margin: "6px 0", borderCollapse: "collapse", fontSize: typography.meta }}>
        {children}
      </table>
    ),
  };
}

const styles: Record<string, React.CSSProperties> = {
  message: {
    maxWidth: "94%",
    minWidth: 0,
    padding: "7px 9px",
    borderRadius: "4px",
    border: "1px solid transparent",
    fontSize: typography.body,
    lineHeight: 1.45,
  },
  timestamp: {
    fontSize: typography.caption,
    opacity: 0.65,
    marginTop: "2px",
    textAlign: "right",
  },
  systemMessage: {
    padding: "3px 7px",
    borderRadius: "4px",
    border: "1px solid #e1e1e1",
    fontSize: typography.meta,
  },
};
```

- [ ] **Step 2: Make the selection popup inherit host typography instead of forcing its own web-font stack**

```css
.ai-assistant-selection-popup {
  font: inherit;
  color: inherit;
}

.ai-assistant-selection-popup .toolbar-button {
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font: inherit;
}
```

```ts
const label = doc.createElement("span");
label.textContent = "Deepseek Copliot";
label.style.cssText =
  "font-size: 0.92em; color: #888; user-select: none; padding-left: 4px;";
```

- [ ] **Step 3: Convert fallback error cards in `ui.ts` to relative sizes**

```ts
Object.assign(title.style, {
  color: "#7f1d1d",
  fontSize: "1.16em",
  fontWeight: "700",
  marginBottom: "8px",
});

Object.assign(detail.style, {
  color: "#991b1b",
  fontSize: "1em",
  lineHeight: "1.5",
});
```

```ts
style: {
  fontSize: "1.16em",
  fontWeight: 700,
}
```

- [ ] **Step 4: Re-run the thread and source-contract tests**

Run:

```bash
npm test -- src/ui/components/ThreadView.test.tsx src/ui/components/NativeTypographySource.test.ts
```

Expected:
- PASS
- thread markup now renders `em`-based heading/table sizing
- popup and fallback source checks no longer find the old absolute `px` literals

- [ ] **Step 5: Commit the thread/popup/fallback migration**

```bash
git add src/ui/components/ThreadView.tsx src/ui/ui.ts src/modules/readerIntegration.ts addon/content/styles.css src/ui/components/ThreadView.test.tsx src/ui/components/NativeTypographySource.test.ts
git commit -m "feat: inherit zotero typography in thread and popup surfaces"
```

## Task 4: Bump The Release Version To v0.9.1 And Run Automated Verification

**Files:**
- Modify: [package.json](/Users/Liang/project/agentpaper_zotero/package.json)
- Modify: [package-lock.json](/Users/Liang/project/agentpaper_zotero/package-lock.json)

- [ ] **Step 1: Update the package version with the lockfile in one command**

Run:

```bash
npm version 0.9.1 --no-git-tag-version
```

Expected:
- `package.json` version becomes `0.9.1`
- `package-lock.json` root version becomes `0.9.1`

- [ ] **Step 2: Run the full typography-focused automated suite**

Run:

```bash
npm test -- src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx src/ui/components/ThreadView.test.tsx src/ui/components/SidebarSource.test.ts src/ui/ui.test.ts
```

Expected:
- PASS
- no regression in the existing sidebar layout tests

- [ ] **Step 3: Run the build and packaged artifact verification**

Run:

```bash
npm run build
npm run verify:xpi
```

Expected:
- build succeeds
- artifact verification succeeds for the `0.9.1` package output

- [ ] **Step 4: Commit the version bump and green automated verification state**

```bash
git add package.json package-lock.json
git commit -m "chore: bump release version to v0.9.1"
```

## Task 5: Perform Manual Zotero Host Verification

**Files:**
- No additional file changes unless manual verification exposes a regression

- [ ] **Step 1: Start the dev loop against Zotero**

Run:

```bash
npm start
```

Expected:
- Zotero launches with the plugin loaded in the dev profile

- [ ] **Step 2: Verify Deepseek Copliot in both library and reader sidebars**

Manual checks:

```text
1. Open the Deepseek Copliot sidebar from a regular library item.
2. Confirm the header, scope summary, list items, empty state, composer, and active thread all look like they belong to Zotero instead of a standalone web app.
3. Open a PDF and confirm the reader sidebar and selection popup use the same host-aligned typography behavior.
```

Expected:
- body text looks like Zotero host text
- meta/badge/timestamp text is slightly smaller but still readable
- no obvious clipped, overlapping, or cramped text

- [ ] **Step 3: Verify `View -> Font Size` host sync**

Manual checks:

```text
1. In Zotero, choose View -> Font Size -> Bigger.
2. Re-check the Deepseek Copliot library sidebar, reader sidebar, composer, markdown thread, and selection popup.
3. Choose View -> Font Size -> Smaller and then Reset.
```

Expected:
- Deepseek Copliot main text grows and shrinks with the host
- relative hierarchy stays intact when the host size changes
- no surface gets stuck at an old fixed size

- [ ] **Step 4: If manual verification exposes a regression, make the smallest aligned fix and rerun only the failing manual/automated check before expanding scope**

```bash
npm test -- src/ui/components/NativeTypographySource.test.ts src/ui/components/Composer.test.tsx src/ui/components/ThreadView.test.tsx src/ui/components/SidebarSource.test.ts src/ui/ui.test.ts
```

Expected:
- only the necessary fix lands
- the final verification loop returns to green before any release claim
