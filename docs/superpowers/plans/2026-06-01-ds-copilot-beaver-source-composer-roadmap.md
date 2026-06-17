# Deepseek Copliot Beaver-Style Source Composer Roadmap

Date: 2026-06-01
Status: Ready for execution
Design: `docs/superpowers/specs/2026-06-01-ds-copilot-beaver-source-composer-design.md`

## Why This Is Split

The approved design spans three independently testable subsystems. Execute them
in order so each merge point leaves Deepseek Copliot usable:

1. core source composition and footer model switching
2. researcher search shortcuts and filters
3. Zotero drag and drop plus packaged acceptance

## Execution Order

1. `docs/superpowers/plans/2026-06-01-ds-copilot-source-composer-tranche-1-core.md`
2. `docs/superpowers/plans/2026-06-01-ds-copilot-source-composer-tranche-2-search-filters.md`
3. `docs/superpowers/plans/2026-06-01-ds-copilot-source-composer-tranche-3-dragdrop-smoke.md`

## Git Rule

The current branch contains pre-existing uncommitted DeepSeek, host-handoff,
and host-tone work. Before source-composer implementation:

1. run the baseline verification commands from Tranche 1 Task 1
2. review the existing diff
3. commit the verified baseline without mixing new source-composer code into it
4. create `codex/beaver-source-composer`

Do not revert or rewrite the existing worktree changes.
