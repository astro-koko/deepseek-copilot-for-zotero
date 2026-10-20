# Development Status

Last updated: 2026-10-21

## Current Web Search Checkpoint (2026-10-21, v1.2.0)

- Release: `1.2.0` on `main`. Lane `provider-context` retrieval-quality rebuild complete and merged from local work.
- Backend now includes: `evidenceQueryPlanner.ts` (intent-driven query planning, max 2 queries, `ori_question`, title exclusion / `after:` operators, follow-up intent inheritance, entity-anchored second angle from paper full text), `evidenceResultFilter.ts` (DOI/arXiv identity extraction, work-level dedup, main-paper folding with catalog-suffix stripping), two-pass gap-refine search in `chatEngine` (zero-independent-result turns get one model-proposed supplement query), context-first assembly in `sendChatMessage`.
- Real-API quality eval on 5 public cases across astronomy/CS/bio: related-work cases yield 8 independent works with 0-1 folded current-paper entries (baseline before this work: 0-1 independent works with 4/5 current-paper catalog pages). WALLABY-anchored follow-up query retrieved WALLABY HIMF literature that topic-keyword search structurally cannot.
- Assets and regression: `scripts/evidence-quality-cases.json`, `scripts/evidence-quality-eval.mjs` (manual, key via `DEEPSEEK_API_KEY` env), committed fixtures `src/services/fixtures/evidence-eval/`, offline regression `evidenceEvalFixture.test.ts`. Raw live metrics in gitignored `docs/debug/2026-10-20-evidence-search-quality/`.
- Full suite 391/391, TypeScript clean, privacy check passed, release XPI verified. Older evidence chain: `docs/debug/2026-10-20-web-search/`.

The following sections retain the older checkpoints for reference.

## Git State

- Active branch: `codex/fix-library-sidebar-responsive-layout`
- Current baseline: `fbdcda7 fix: keep Zotero sidebar visible and anchored on resize`
- `main`: `9ef8e2a merge: prepare v1.0.0 release candidate`
- Merge status: not merged; no public `1.0.0` release has been cut.
- The baseline commit is the starting point for future micro-feature windows.

## Acceptance State

| Area                           | State     | Evidence or next action                                              |
| ------------------------------ | --------- | -------------------------------------------------------------------- |
| Unit and source-contract tests | Passed    | Focused 89/89; full 315/315                                          |
| Dev XPI packaging              | Passed    | Dev build, manifest inspection, and artifact verification passed     |
| Native XPI import              | Passed    | Imported through Zotero Plugins Manager, not marketplace             |
| Reader section visibility      | Passed    | Cold restart shows the long restored conversation and composer       |
| Section collapse/reopen        | Passed    | Body reappears after native section is reopened                      |
| Full responsive width matrix   | Follow-up | Run Library and Reader `wide -> 350 -> 280 -> 260 -> wide -> narrow` |
| Reader scope isolation         | Follow-up | Repeat `A -> B -> A` and verify document-owned history               |
| Release smoke                  | Pending   | Clean release profile, release XPI, restart evidence, privacy gate   |

## Git Workflow For New Windows

1. Start from `fbdcda7`; inspect `git status` before editing.
2. Declare one iteration lane before touching files.
3. Keep each micro-feature in a focused commit with tests.
4. Preserve the intentionally uncommitted user files listed below.
5. Do not merge to `main` until the full responsive matrix, clean-profile
   release smoke, and release artifact gates are complete.

Recommended gates by change type:

```text
logic/service       focused Vitest -> npm test
host/Reader         focused host tests -> npm test -> build:dev:xpi -> real Zotero
release/build       npm run check -> build:dev:xpi -> build:release:xpi -> verify:xpi
```

## Intentionally Uncommitted Worktree Files

These files predate or sit outside the committed runtime baseline and must not
be swept into a future feature commit without an explicit decision:

- `AGENTS.md`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-dev-workbench.md`
- `docs/zotero-doc-index.md`
- `docs/zotero-sidebar-stability-review.md`
- `docs/academic-search-mcp-options.md`
- `docs/zotero-sidebar-layout-contract.md`
