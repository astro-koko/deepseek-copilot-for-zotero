---
name: zotero-real-smoke
description: Use when running, designing, reviewing, or debugging real Zotero smoke tests for Deepseek Copliot, especially packaged XPI install, cold restart, Add-ons visibility, Settings, Library/Reader right-pane hosts, Reader Explain/Ask handoff, provider round-trip, or smoke evidence collection.
---

# Zotero Real Smoke

Real smoke is evidence collection, not improvisation.

## Required Reads

Read these before action:

- `AGENTS.md`
- `docs/zotero-real-smoke-guardrails.md`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-dev-workbench.md`
- `docs/agent-dev-workflow.md`

If build behavior matters, also read:

- `zotero-plugin.config.ts`
- `scripts/verify-build-artifact.mjs`
- `scripts/verify-build-artifact-lib.mjs`

## Layer Order

Never debug a later layer before the earlier layer is proven in the current run:

1. packaged artifact exists
2. plugin import succeeds
3. Add-ons entry appears
4. Settings pane appears
5. Library host appears
6. Reader host appears
7. Reader popup/menu handoff works
8. provider response works
9. cold restart reproduces the critical path

## GUI Guardrails

- Use one control plane per micro-task.
- Before every mutating GUI action, record frontmost app, active window title, target surface, and planned action.
- After two same-class failures in one layer, stop and collect evidence.
- Do not change branding, icons, or surface ownership as a smoke shortcut.
- Do not edit Zotero profile registries or installed extension files by hand.
- Local `.env` credentials may be used only to help an agent perform real GUI/provider smoke without manual typing. Do not treat them as product defaults or public release-profile preload.

## Evidence Output

For each run, produce or request:

- XPI path and hash
- manifest `version`, `version_name`, addon id, update URL
- Zotero version, profile path, data dir class: daily/dev/clean
- Debug Output excerpt
- screenshots or GUI notes for visible surfaces
- hostSmoke JSON if available
- pass/fail by layer
- next failure class and follow-up issue

If blocked, report the exact layer and failure class. Do not continue with speculative clicks.
