# DS Copilot Formula Rendering Design

## Status

Approved for implementation on the isolated test branch `codex/formula-prompt-render-test`.

## Goal

Fix assistant answers that expose LaTeX delimiters or escaped commands, especially responses where formulas appear as raw `$$`, `\\epsilon`, `\\sum`, or similar text in the Zotero sidebar.

The fix should be a double guard:

- Prompt-side: tell the model how to write formulas for this plugin.
- Render-side: tolerate model output that still contains Markdown math delimiters or JSON-style escaped LaTeX commands.

## Background

The current message renderer uses `react-markdown` with GFM and line-break support. That stack renders regular Markdown well, but it does not parse math delimiters. When the assistant returns a block such as:

```text
$$
C_F(q, y) = \epsilon^2_{FG} \sum_X A_X ...
$$
```

the sidebar treats the delimiters and LaTeX commands as ordinary Markdown text. Some model outputs also contain doubled backslashes such as `\\epsilon`, which are valid inside JSON strings but look wrong once the provider has already decoded the message content for display.

Prompt changes alone are insufficient because older messages and occasional model drift can still produce raw math. Rendering changes alone are also insufficient because the model can avoid most failures if it is told the plugin's exact display contract. This design therefore uses both.

## Scope

This change includes:

- Add an explicit formula formatting rule to the system prompt in `src/services/chatEngine.ts`.
- Keep ordinary Markdown rendering for paragraphs, lists, links, code fences, tables, emphasis, and headings.
- Add a local math-aware message splitter in `src/ui/components/ThreadView.tsx`.
- Render block formulas delimited by `$$...$$`, `\[...\]`, or `\begin{equation}...\end{equation}` as readable formula blocks.
- Render inline formulas delimited by `$...$` or `\(...\)` as inline formula spans.
- Normalize common model double-escaping inside formula segments, such as `\\epsilon` to `\epsilon`.
- Add focused tests for the prompt contract and message rendering behavior.

This change does not include:

- Adding KaTeX, MathJax, or a full TeX layout engine.
- Supporting arbitrary TeX packages or perfect visual math typesetting.
- Changing provider request/response transport.
- Changing persistence or exported Markdown behavior.
- Changing Reader integration, Zotero host registration, settings UI, package version, release manifests, icons, or branding.
- Running a public release smoke or widening Zotero compatibility.

## Design

### 1. Prompt Contract

The system prompt should tell the model:

- Use Markdown for structure.
- For formulas, use normal LaTeX math delimiters.
- Use `$...$` for short inline formulas.
- Use `$$...$$` for display formulas.
- Use single LaTeX backslashes in visible answers.
- Do not double-escape LaTeX commands as if writing JSON.
- Do not wrap formulas in fenced code blocks unless the user explicitly asks for source text.

The prompt should remain concise. It should not over-prescribe the answer structure or add a long style guide to every request.

### 2. Renderer Contract

`ThreadView` should keep `ReactMarkdown` as the Markdown renderer, but it should split message content into alternating markdown and math segments before rendering:

- Markdown segments go through the existing `ReactMarkdown` path.
- Math segments render through a small React component that displays readable formula text.

This keeps math handling local to chat messages and avoids changing shared provider or persistence code.

### 3. Math Segment Rules

The splitter should recognize:

- Block math:
  - `$$...$$`
  - `\[...\]`
  - `\begin{equation}...\end{equation}`
- Inline math:
  - `$...$`
  - `\(...\)`

The splitter should avoid false positives:

- Ignore single-dollar markers that do not have a closing single-dollar marker.
- Do not treat `$$...$$` as inline math.
- Do not scan inside fenced code blocks.
- Leave ordinary Markdown tables, links, emphasis, and code spans to `ReactMarkdown`.
- Avoid treating currency-like text as math when no balanced delimiter exists.

### 4. Formula Display

Because this is not a full TeX renderer, formula display should optimize for readability, not perfect typesetting:

- Strip only the outer delimiter.
- Preserve internal line breaks.
- Normalize doubled command backslashes inside math segments.
- Use a monospace or tabular-looking formula style only inside formula spans/blocks.
- Keep block math horizontally scrollable rather than wrapping into unreadable fragments.
- Keep inline math compact and aligned with surrounding text.

This is intentionally a graceful fallback. A future KaTeX/MathJax pass can replace the formula component without changing provider or persistence contracts.

## Edge Conditions

- Existing saved assistant messages with raw `$$...$$` should render better without being migrated.
- Streaming content in branches that already pass drafts through `MarkdownMessage` should benefit automatically once merged with this renderer.
- Malformed math delimiters should degrade to ordinary Markdown text rather than hiding content.
- Formulas inside code fences must remain code, because code examples are often meant to show literal source.
- Formula text containing Markdown characters such as `_`, `*`, `{}`, or `|` must not be reinterpreted as Markdown after segmentation.
- User messages and system messages can use the same renderer; math support should not be assistant-only.
- Raw HTML must remain escaped through the existing ReactMarkdown safety behavior.
- The fix must not require network access at runtime.

## Files

Expected changes:

- `src/services/chatEngine.ts`
- `src/services/chatEngine.test.ts`
- `src/ui/components/ThreadView.tsx`
- `src/ui/components/ThreadView.test.tsx`
- This design spec
- The implementation plan

No expected changes:

- `package.json`
- `package-lock.json`
- Zotero manifest or release files
- Preferences UI
- Reader integration

## Acceptance Criteria

1. The system prompt contains a concise formula formatting contract.
2. `$$...$$` display formulas render without visible outer `$$` delimiters.
3. `$...$` inline formulas render without visible outer dollar delimiters.
4. Double-escaped LaTeX commands inside formula segments display as single-backslash commands.
5. Fenced code blocks containing dollar signs are still rendered as code.
6. Existing Markdown behavior remains intact for headings, lists, tables, links, code, emphasis, blockquotes, and raw HTML escaping.
7. Focused tests for `ThreadView` and `chatEngine` pass.
8. Broader `npm test` passes before merging to `main`.

## Verification

Use the smallest meaningful gate first:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx src/services/chatEngine.test.ts
npm test
```

If this branch is later promoted to packaged release work, run the normal XPI gates separately. This formula fix by itself does not claim packaged Zotero release acceptance.

## Merge Plan

Develop and verify on `codex/formula-prompt-render-test`. Merge back to `main` only after tests pass and after the existing dirty `main` working tree is made safe for merge by committing, stashing, or otherwise separating unrelated local changes.
