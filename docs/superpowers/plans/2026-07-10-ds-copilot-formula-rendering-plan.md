# DS Copilot Formula Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prompt contract and local chat-message rendering fallback so formulas render readably instead of exposing raw math delimiters and doubled LaTeX backslashes.

**Architecture:** Keep provider and persistence untouched. Add formula instructions to the system prompt, and make `ThreadView` split message content into Markdown and math segments before handing Markdown segments to `ReactMarkdown`.

**Tech Stack:** TypeScript, React, ReactMarkdown, Vitest, `renderToStaticMarkup`.

---

## File Structure

- Modify `src/services/chatEngine.ts`
  - Add concise formula output rules to `buildSystemPrompt`.
- Modify `src/services/chatEngine.test.ts`
  - Assert the system prompt includes the formula contract.
- Modify `src/ui/components/ThreadView.tsx`
  - Add local helpers for fenced-code-aware math segmentation.
  - Add `MathMessageSegment` rendering for inline and block formula text.
  - Keep existing Markdown renderer behavior unchanged for non-math segments.
- Modify `src/ui/components/ThreadView.test.tsx`
  - Add regression tests for block math, inline math, double-escaped LaTeX, and code fences.
- Add `docs/superpowers/specs/2026-07-10-ds-copilot-formula-rendering-design.md`
- Add `docs/superpowers/plans/2026-07-10-ds-copilot-formula-rendering-plan.md`

## Task 1: Prompt Contract

**Files:**

- Modify: `src/services/chatEngine.ts`
- Test: `src/services/chatEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("chatEngine", () => { ... })`:

```ts
it("instructs the model to emit displayable LaTeX formulas", async () => {
  await sendChatMessage(makeThread([]), undefined);

  const [messages] = providerMocks.sendChat.mock.calls[0] || [];
  expect(messages[0].content).toContain("$...$");
  expect(messages[0].content).toContain("$$...$$");
  expect(messages[0].content).toContain("single LaTeX backslashes");
  expect(messages[0].content).toContain("Do not double-escape");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run src/services/chatEngine.test.ts
```

Expected: FAIL because the system prompt does not yet include the formula contract.

- [ ] **Step 3: Implement minimal prompt change**

In `buildSystemPrompt`, replace the existing Markdown rule:

```ts
- 回答要简洁但充分，必要时可以使用 Markdown。
```

with:

```ts
- 回答要简洁但充分，必要时可以使用 Markdown。
- Formula formatting: use `$...$` for short inline formulas and `$$...$$` for display formulas. Use single LaTeX backslashes in visible answers, for example `\epsilon` not `\\epsilon`. Do not double-escape LaTeX commands as if writing JSON, and do not wrap formulas in code fences unless the user asks for literal source text.
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --run src/services/chatEngine.test.ts
```

Expected: PASS.

## Task 2: Math-Aware Message Rendering

**Files:**

- Modify: `src/ui/components/ThreadView.tsx`
- Test: `src/ui/components/ThreadView.test.tsx`

- [ ] **Step 1: Write failing rendering tests**

Add tests inside `describe("ThreadView markdown rendering", () => { ... })`:

````ts
it("renders display math blocks without exposing outer delimiters", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: [
            "模型为：",
            "$$",
            "C_F(q, y) = \\\\epsilon^2_{FG} \\\\sum_X A_X",
            "$$",
          ].join("\n"),
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("ai-assistant-math-block");
  expect(markup).toContain("C_F(q, y)");
  expect(markup).toContain("\\epsilon^2_{FG}");
  expect(markup).toContain("\\sum_X");
  expect(markup).not.toContain("$$");
  expect(markup).not.toContain("\\\\epsilon");
});

it("renders inline math without exposing dollar delimiters", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: "其中 $\\\\epsilon_{FG}=1$ 表示无前景去除。",
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("ai-assistant-math-inline");
  expect(markup).toContain("\\epsilon_{FG}=1");
  expect(markup).not.toContain("$\\\\epsilon");
});

it("leaves dollar signs inside fenced code blocks as code", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ThreadView, {
      thread: makeThread([
        {
          id: "msg-assistant",
          role: "assistant",
          content: ["```tex", "$$", "E = mc^2", "$$", "```"].join("\n"),
          timestamp: 1,
        },
      ]),
    }),
  );

  expect(markup).toContain("<pre style=");
  expect(markup).toContain("E = mc^2");
  expect(markup).toContain("$$");
  expect(markup).not.toContain("ai-assistant-math-block");
});
````

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx
```

Expected: FAIL because formulas are still rendered as ordinary Markdown text.

- [ ] **Step 3: Implement local segmentation and rendering**

Add these local units near the Markdown renderer in `ThreadView.tsx`:

```ts
type MessageSegment =
  | { type: "markdown"; value: string }
  | { type: "math"; value: string; display: boolean };
```

Implement these helpers in the same file:

- `splitMessageSegments(content)` finds block math outside fenced code and returns alternating Markdown/math segments.
- `findNextDisplayMath(content, fromIndex)` scans for `$$...$$`, `\[...\]`, and `\begin{equation}...\end{equation}` while skipping fenced code.
- `readDelimitedMath(content, start, open, close)` strips only the outer delimiter.
- `splitInlineMathText(text)` and `findNextInlineMath(text, fromIndex)` find `$...$` and `\(...\)` inside Markdown text children.
- `normalizeMathText(value)` trims formula text and turns doubled model escapes like `\\epsilon` into `\epsilon`.
- `renderInlineMath(children, theme)` replaces string children inside paragraph-like Markdown components with inline math spans.
- `MathMessageSegment` renders block math with `className="ai-assistant-math-block"` and inline math with `className="ai-assistant-math-inline"`.

Update `MarkdownMessage` so math segments render through `MathMessageSegment` and Markdown segments still render through `ReactMarkdown`.

- [ ] **Step 4: Run focused rendering tests**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx
```

Expected: PASS.

## Task 3: Regression Sweep

**Files:**

- Modify if needed: `src/ui/components/ThreadView.tsx`
- Modify if needed: `src/services/chatEngine.ts`

- [ ] **Step 1: Run both focused suites**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx src/services/chatEngine.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Inspect branch diff**

Run:

```bash
git diff -- src/services/chatEngine.ts src/services/chatEngine.test.ts src/ui/components/ThreadView.tsx src/ui/components/ThreadView.test.tsx docs/superpowers/specs/2026-07-10-ds-copilot-formula-rendering-design.md docs/superpowers/plans/2026-07-10-ds-copilot-formula-rendering-plan.md
```

Expected: diff contains only formula prompt/rendering changes plus spec and plan.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-07-10-ds-copilot-formula-rendering-design.md docs/superpowers/plans/2026-07-10-ds-copilot-formula-rendering-plan.md src/services/chatEngine.ts src/services/chatEngine.test.ts src/ui/components/ThreadView.tsx src/ui/components/ThreadView.test.tsx
git commit -m "fix: render latex formulas in chat"
```

Expected: commit succeeds on `codex/formula-prompt-render-test`.

## Task 4: Merge Back To Main

**Files:**

- No file edits expected during this task.

- [ ] **Step 1: Check the original main worktree**

Run:

```bash
git -C /Users/Liang/project/DeepseekCopliot_zotero status --short
```

Expected: If unrelated local changes remain, do not merge automatically.

- [ ] **Step 2: Merge only when main is safe**

When the main worktree is clean or the unrelated changes have been separated, run:

```bash
git -C /Users/Liang/project/DeepseekCopliot_zotero switch main
git -C /Users/Liang/project/DeepseekCopliot_zotero merge --no-ff codex/formula-prompt-render-test
```

Expected: merge succeeds without overwriting unrelated local work.

- [ ] **Step 3: Re-run focused tests on main**

Run:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx src/services/chatEngine.test.ts
```

Expected: PASS on `main`.

## Self-Review

- Spec coverage: prompt contract, renderer fallback, edge cases, verification, and merge safety are covered.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: helpers are local to `ThreadView.tsx`; no provider or persistence type changes are required.
