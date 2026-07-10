# Deepseek Copliot KaTeX Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Deepseek Copliot chat formulas from readable TeX fallback text to bundled KaTeX-rendered inline and display math.

**Architecture:** Keep the existing formula delimiter parser in `ThreadView` and replace the math text renderer with a KaTeX renderer. Ship KaTeX CSS/fonts as local addon assets so dev proxy, dev XPI, release XPI, and real Zotero all use the same packaged resources.

**Tech Stack:** React 18, ReactMarkdown, Vitest, KaTeX, Zotero Plugin Scaffold, Zotero native Add-ons manager.

---

## File Map

- `src/ui/components/ThreadView.tsx`: owns chat message Markdown and math rendering.
- `src/ui/components/ThreadView.test.tsx`: owns server-rendered regression tests for Markdown, formula segmentation, KaTeX markup, malformed formulas, and streaming content.
- `addon/content/styles.css`: loads plugin CSS and imports bundled KaTeX CSS.
- `addon/content/katex/`: bundled KaTeX CSS and fonts copied from `node_modules/katex/dist`.
- `package.json`: adds `katex`.
- `package-lock.json`: locks the installed KaTeX package.
- `scripts/verify-build-artifact-lib.mjs`: optionally verifies KaTeX archive entries if the existing verifier does not.

## Task 1: Add KaTeX Rendering Tests

**Files:**
- Modify: `src/ui/components/ThreadView.test.tsx`

- [ ] **Step 1: Write failing KaTeX tests**

Add tests near the existing formula tests:

```ts
it("typesets display math with KaTeX markup", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: ["公式：", "$$", "E = mc^2", "$$"].join("\n"),
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("ai-assistant-math-block");
  expect(markup).toContain("katex-display");
  expect(markup).toContain("katex-html");
  expect(markup).toContain("mord mathnormal");
  expect(markup).not.toContain("$$");
});

it("typesets inline math with KaTeX markup", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: "能量公式是 $E=mc^2$。",
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("ai-assistant-math-inline");
  expect(markup).toContain("katex");
  expect(markup).toContain("katex-html");
  expect(markup).not.toContain("$E=mc");
});

it("keeps malformed math visible instead of throwing", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: "坏公式 $\\notacommand{$ 也不能炸掉线程。",
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("ai-assistant-math-inline");
  expect(markup).toContain("notacommand");
  expect(markup).toContain("也不能炸掉线程");
});

it("typesets streaming math through the same renderer", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      streamingMessage: {
        content: "流式输出 $\\alpha + \\beta$",
        reasoningContent: "$$\\sum_i x_i$$",
        statusLabel: "Responding",
      },
      thread: makeThread([]),
    }),
  );

  expect(markup).toContain("Responding");
  expect(markup).toContain("katex");
  expect(markup).toContain("katex-display");
  expect(markup).not.toContain("$$");
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx
```

Expected: the new tests fail because current formula rendering emits plain text and no KaTeX classes.

## Task 2: Add KaTeX Dependency And Assets

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `addon/content/styles.css`
- Create: `addon/content/katex/katex.min.css`
- Create: `addon/content/katex/fonts/*`

- [ ] **Step 1: Install KaTeX**

Run:

```bash
npm install katex
```

Expected: `package.json` includes `katex` under `dependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Copy KaTeX CSS and fonts into addon assets**

Run:

```bash
mkdir -p addon/content/katex
cp node_modules/katex/dist/katex.min.css addon/content/katex/katex.min.css
cp -R node_modules/katex/dist/fonts addon/content/katex/fonts
```

Expected: `addon/content/katex/katex.min.css` and font files exist.

- [ ] **Step 3: Load KaTeX CSS from plugin stylesheet**

At the top of `addon/content/styles.css`, add:

```css
@import url("chrome://zotero-ai-assistant/content/katex/katex.min.css");
```

Expected: Zotero loads KaTeX styles through the same stylesheet registration used by the plugin.

## Task 3: Render Math Segments With KaTeX

**Files:**
- Modify: `src/ui/components/ThreadView.tsx`

- [ ] **Step 1: Import KaTeX**

Add:

```ts
import katex from "katex";
```

- [ ] **Step 2: Add a render helper**

Add this helper near `normalizeMathText`:

```ts
function renderMathHtml(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      output: "htmlAndMathml",
      errorColor: "#b42318",
      strict: "warn",
      trust: false,
    });
  } catch {
    return "";
  }
}
```

- [ ] **Step 3: Replace text-only math rendering**

Update `MathMessageSegment` so successful KaTeX output uses `dangerouslySetInnerHTML`, and unexpected failures fall back to text:

```tsx
const MathMessageSegment: React.FC<{
  display: boolean;
  theme: ReturnType<typeof getSidebarTheme>;
  value: string;
}> = ({ display, theme, value }) => {
  const renderedMath = renderMathHtml(value, display);

  if (display) {
    return (
      <div
        className="ai-assistant-math-block"
        style={{
          ...styles.mathBlock,
          background: theme.panelBackground,
          borderColor: theme.softBorder,
        }}
        {...(renderedMath
          ? { dangerouslySetInnerHTML: { __html: renderedMath } }
          : { children: value })}
      />
    );
  }

  return (
    <span
      className="ai-assistant-math-inline"
      style={styles.mathInline}
      {...(renderedMath
        ? { dangerouslySetInnerHTML: { __html: renderedMath } }
        : { children: value })}
    />
  );
};
```

- [ ] **Step 4: Adjust math-specific inline styles**

Remove monospace-only styling from `styles.mathBlock` and `styles.mathInline`, keeping spacing, scroll behavior, and `whiteSpace` only where it helps display math:

```ts
mathBlock: {
  margin: "6px 0",
  padding: "7px 8px",
  border: "1px solid transparent",
  borderRadius: "4px",
  fontSize: typography.body,
  lineHeight: 1.45,
  overflowX: "auto",
  overflowY: "hidden",
},
mathInline: {
  fontSize: "1em",
  whiteSpace: "nowrap",
},
```

- [ ] **Step 5: Run focused tests and verify green**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx
```

Expected: all `ThreadView` tests pass.

## Task 4: Package Verification

**Files:**
- Modify only if needed: `scripts/verify-build-artifact-lib.mjs`

- [ ] **Step 1: Build a dev XPI**

Run:

```bash
npm run build:dev:xpi
```

Expected: build succeeds and creates a dev XPI under `.scaffold/build`.

- [ ] **Step 2: Verify XPI archive includes KaTeX assets**

Run:

```bash
npm run verify:xpi
unzip -Z1 .scaffold/build/*.xpi | rg 'content/katex/(katex.min.css|fonts/)'
```

Expected: `verify:xpi` passes and the archive listing includes `content/katex/katex.min.css` plus KaTeX font files.

- [ ] **Step 3: Tighten verifier if archive check is manual-only**

If `verify:xpi` does not check KaTeX assets, add required archive entries in `scripts/verify-build-artifact-lib.mjs` so missing `content/katex/katex.min.css` and at least one font file fail the packaged gate.

## Task 5: Full Automated Verification

**Files:**
- No source changes unless failures reveal bugs in this branch.

- [ ] **Step 1: Run focused formula and prompt tests**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx src/services/chatEngine.test.ts
```

Expected: focused tests pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run release preflight that can tolerate local privacy state**

Run:

```bash
npm run build:dev:xpi
npm run verify:xpi
```

Expected: build and packaged verification pass. If `npm run check` fails only because a local private `.env` exists, record that exactly and do not delete `.env`.

## Task 6: Real Zotero Dev XPI Smoke

**Files:**
- Create or update smoke evidence note only if this branch already uses a smoke evidence file. Otherwise record evidence in the final report.

- [ ] **Step 1: Prove the XPI path and hash**

Run:

```bash
ls -lt .scaffold/build/*.xpi | head -1
shasum -a 256 .scaffold/build/*.xpi
unzip -p .scaffold/build/*.xpi manifest.json
```

Expected: newest dev XPI path, hash, and manifest version are recorded.

- [ ] **Step 2: Install through Zotero native Add-ons/Plugins manager**

Use Zotero's native `Install Plugin From File...` path. Do not use Add-on Market.

Expected: Add-ons entry shows `Deepseek Copliot` and the installed version/hash matches the dev XPI.

- [ ] **Step 3: Smoke the critical host path**

Record:

- Add-ons entry exists.
- Settings pane opens.
- Library native right-pane entry appears.
- Reader native right-pane entry appears.
- A real chat message with `$E=mc^2$` and `$$\sum_i x_i$$` displays KaTeX-formatted formulas.
- No truncated top-toolbar-only `D...` artifact appears.

- [ ] **Step 4: Cold restart Zotero and re-smoke**

Restart Zotero and repeat:

- Add-ons entry exists.
- Settings pane opens.
- Library native right-pane entry appears.
- Reader native right-pane entry appears.
- Restored or new formula message still renders as KaTeX.

## Task 7: Prepare Release Next Step

**Files:**
- Modify later: `CHANGELOG.md`
- Modify later: `package.json`

- [ ] **Step 1: Decide version after dev smoke**

If dev smoke passes, choose whether this is:

- `0.9.9`: narrow formula rendering improvement, or
- `0.10.0`: formula rendering plus broader user-facing release narrative.

- [ ] **Step 2: Build release XPI only after dev smoke**

Run:

```bash
npm run build:release:xpi
npm run verify:xpi
```

Expected: release XPI builds and verifies. Public GitHub release still requires clean-profile release smoke before upload.

## Self-Review

- Spec coverage: every design requirement maps to Task 1 through Task 7.
- Placeholder scan: no placeholder markers or unspecified "add tests" steps remain.
- Type consistency: the plan uses existing `ThreadView`, `Thread`, `makeThread`, and `renderToStaticMarkup` test patterns.
- Scope check: provider, Reader handoff, Settings, branding, and compatibility range are explicitly out of scope.
