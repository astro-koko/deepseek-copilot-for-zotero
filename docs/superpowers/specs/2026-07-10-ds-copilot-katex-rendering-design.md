# Deepseek Copliot KaTeX Rendering Design

Status: Approved for implementation on `codex/formula-katex-renderer`
Owner: Codex
Related issue: Formula rendering upgrade after `84e2c90 fix: render latex formulas in chat`
Target release: next public release after `0.9.8`

## Problem

Deepseek Copliot currently has a lightweight formula fallback: chat messages are split around math delimiters, outer `$...$` or `$$...$$` markers are hidden, and common double-escaped LaTeX commands are normalized. This makes formulas readable, but it does not typeset them. Users still see raw TeX text instead of publication-quality math.

For a Zotero reading assistant, formulas are part of the reading surface. The next version should render assistant, user, streaming, and restored thread formulas with real mathematical layout inside Zotero's Library and Reader right-pane surfaces.

## Goals

- Render inline and display formulas through KaTeX instead of monospace TeX text.
- Preserve the existing prompt-side formula contract so model output remains predictable.
- Preserve the existing delimiter-aware segmentation behavior for code fences and malformed delimiters.
- Package the CSS and font assets needed by KaTeX into the `.xpi`.
- Validate the change first with focused tests, then with a dev XPI imported through Zotero's native plugin manager.
- Record real Zotero evidence for install chain, Settings, Library host, Reader host, formula rendering, and restart behavior.

## Non-goals

- Do not replace the whole Markdown renderer.
- Do not add MathJax or remote CDN assets.
- Do not change provider transport, persistence, Reader handoff, Settings behavior, branding, or icon ownership.
- Do not widen Zotero compatibility claims.
- Do not make public release claims until a release XPI passes clean-profile smoke.

## User Workflow

1. A user asks a paper question that involves notation.
2. The assistant answers using `$...$` for inline formulas and `$$...$$` for display formulas.
3. The sidebar displays formulas as formatted math, not raw delimiters or raw TeX commands.
4. If a formula contains unsupported or malformed TeX, the sidebar keeps the message visible and shows the problematic formula source instead of breaking the thread.
5. After Zotero restarts, the same restored thread still renders formulas correctly.

## Scope And Boundaries

Lane: `ui message rendering` plus required `release-build` asset packaging.

In scope:

- `src/ui/components/ThreadView.tsx`
- `src/ui/components/ThreadView.test.tsx`
- `src/services/chatEngine.ts` and focused prompt tests only if the formula contract needs tightening
- `addon/content/styles.css`
- `package.json` and `package-lock.json`
- build or verification scripts if KaTeX packaged assets need explicit verification

Out of scope:

- `src/modules/readerIntegration.ts`
- `src/ui/ui.ts`
- `src/modules/preferencesPane*`
- provider implementations
- Zotero manifest compatibility range
- GitHub release publishing until dev XPI smoke passes

## Design Decisions

### Math Renderer

Use the `katex` package directly from `ThreadView`, calling `katex.renderToString()` for each math segment.

This keeps the existing delimiter-aware parser in control. It also avoids changing the whole ReactMarkdown pipeline, which would make code fence handling, currency-like text, and streaming partial messages harder to reason about.

### Delimiter Handling

Keep the current two-layer parser:

- block math: `$$...$$`, `\[...\]`, and `\begin{equation}...\end{equation}` outside fenced code
- inline math: `$...$` and `\(...\)` inside Markdown text nodes

Do not treat unbalanced delimiters as math. Do not parse math inside fenced code blocks.

### Error Handling

Render with:

- `displayMode` from the segment type
- `throwOnError: false`
- `output: "htmlAndMathml"`
- a local error color that is visible in light and dark Zotero themes

If KaTeX still throws unexpectedly, fall back to escaped text inside the existing math block/span. A bad formula must not blank the message or break the sidebar.

### CSS And Assets

KaTeX requires its CSS and fonts for correct visual output. The plugin must ship those assets inside the XPI and load them through Zotero's chrome URL, not a CDN.

The implementation should either:

- copy the KaTeX CSS/fonts into `addon/content/katex/`, or
- add a deterministic build step that copies them into `.scaffold/build/addon/content/katex/` and verifies the archive entries.

The preferred first implementation is a committed `addon/content/katex/` asset directory because `npm start`, `npm run build:dev:xpi`, and `npm run build:release:xpi` can all use the same source assets.

## Files Expected To Change

- `package.json`
- `package-lock.json`
- `addon/content/styles.css`
- `addon/content/katex/katex.min.css`
- `addon/content/katex/fonts/*`
- `addon/content/katex/LICENSE.txt`
- `src/ui/components/ThreadView.tsx`
- `src/ui/components/ThreadView.test.tsx`
- `docs/superpowers/specs/2026-07-10-ds-copilot-katex-rendering-design.md`
- `docs/superpowers/plans/2026-07-10-ds-copilot-katex-rendering-plan.md`

Build verification may also update:

- `scripts/verify-build-artifact-lib.mjs`
- `scripts/verify-build-artifact.mjs`

Only update those scripts if the existing archive verification does not catch missing KaTeX assets.

## Acceptance Criteria

- Inline formulas render KaTeX markup with no visible `$` delimiters.
- Display formulas render KaTeX markup with no visible `$$` delimiters.
- Double-escaped model output such as `\\epsilon` normalizes before KaTeX rendering.
- Fenced code blocks containing `$` or `$$` remain code.
- Malformed formulas keep the message visible and do not throw during server-side rendering tests.
- Streaming assistant content uses the same formula renderer as persisted thread messages.
- The dev XPI contains KaTeX CSS and font assets.
- A dev XPI imported through Zotero's native plugin manager renders a real formula response in Zotero.
- Zotero restart keeps Add-ons, Settings, Library/Reader host surfaces, and formula rendering intact.

## Verification Plan

Focused tests:

```bash
npm test -- --run src/ui/components/ThreadView.test.tsx src/services/chatEngine.test.ts
```

Broad tests:

```bash
npm test
```

Build and packaged artifact:

```bash
npm run build:dev:xpi
npm run verify:xpi
unzip -Z1 .scaffold/build/*.xpi | rg 'content/katex/(katex.min.css|fonts/)'
```

Real Zotero dev smoke:

1. Install the newest dev XPI through Zotero's native Add-ons/Plugins manager.
2. Confirm the Add-ons entry or installed manifest/hash matches the newly built XPI.
3. Confirm Settings pane opens.
4. Confirm Library right-pane Deepseek Copliot surface appears.
5. Confirm Reader right-pane Deepseek Copliot surface appears.
6. Send or restore a message containing inline and display formulas.
7. Confirm formulas are visually typeset and no `$$` delimiters are visible.
8. Cold restart Zotero and repeat Add-ons, Settings, Library/Reader host, and formula rendering checks.

Public release smoke happens only after dev XPI smoke passes.

## Rollout Or Release Notes

Suggested release note:

> Improved formula rendering in chat answers with bundled KaTeX support for inline and display LaTeX math.

## Risks And Mitigations

- Risk: KaTeX CSS or fonts missing in packaged Zotero.
  Mitigation: verify archive entries and inspect real Zotero rendering after dev XPI import.
- Risk: KaTeX throws on partial streaming formulas.
  Mitigation: use `throwOnError: false` and catch unexpected render errors with text fallback.
- Risk: Markdown parsing regresses around code blocks or dollar amounts.
  Mitigation: keep the existing segmentation logic and extend the existing focused tests.
- Risk: XPI size increases.
  Mitigation: ship only KaTeX CSS and fonts required by `katex.min.css`; no CDN, no MathJax bundle.

## Open Questions

- Version number is not changed in this branch until the dev XPI smoke result is known.
- Public release publishing is a separate follow-up step after release-profile smoke.
