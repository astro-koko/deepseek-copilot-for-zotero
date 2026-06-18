# Agent Instructions

This repository builds Deepseek Copliot, a Zotero-native reading assistant. Treat packaged `.xpi` behavior in real Zotero as the meaningful acceptance surface.

## First Reads

Before changing Zotero integration, release behavior, settings, Reader handoff, or smoke tests, read:

- `docs/agent-dev-workflow.md`
- `docs/zotero-dev-workbench.md`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-real-smoke-guardrails.md`
- `docs/zotero-doc-index.md`
- `docs/iteration-lanes.md`

For reference comparisons, prefer local snapshots:

- `reference/upstream-docs/` for Zotero/scaffold/toolkit rules
- `reference/beaver-zotero/` for Reader/sidebar orchestration and lifecycle patterns
- `reference/aidea-zotero/` for architecture documentation patterns
- `reference/llm-for-zotero/` for agent/test-gate patterns

Reference projects are pattern libraries, not copy sources. For details, read `docs/reference-adoption.md`.

## Development Rules

- Daily development and primary smoke target Zotero 9 release. Zotero 10 beta is compatibility-only; do not widen `strict_max_version` for Zotero 10 until a packaged `.xpi` passes Zotero 10 beta smoke.
- Configure Zotero paths through local `.env`: `ZOTERO_PLUGIN_ZOTERO_BIN_PATH`, `ZOTERO_PLUGIN_PROFILE_PATH`, and `ZOTERO_PLUGIN_DATA_DIR`. Do not hard-code private machine paths in code or committed docs.
- Keep development and release profiles separate. Dev work may use `.scaffold/profile` or `.scaffold/dev-profile`; public release smoke must use a clean profile and clean Zotero data directory.
- Keep `package.json` on the clean release version. Use `npm run build:dev:xpi` for installable dev packages and `npm run build:release:xpi` for public artifacts.
- `npm start` is only a rapid iteration loop. Release acceptance requires packaged `.xpi` import and Zotero restart evidence.
- Deepseek Copliot development smoke must import the latest local dev, non-stable XPI through Zotero's native Add-ons/Plugins manager with `Install Plugin From File...`. Do not use Add-on Market / 插件市场 to install or validate this plugin. Before testing Settings or other UI behavior, verify the Add-ons entry or installed XPI manifest version/hash matches the newly built dev XPI; a visible Settings pane does not prove Zotero is running the latest plugin code.
- If Zotero shows an unexpected `External App undefined wants to execute command...` style prompt during smoke, treat it as suspicious and deny it unless the exact command was intentionally initiated and understood.
- When validating the Settings `Commands and Prompts` section, first prove Zotero is actually running the new dev XPI. If custom-command controls such as add, restore built-ins, validate JSON, preview, or apply import are unusable, treat that as a real product bug unless the installed package is proven stale. The primary Settings UI must not expose two competing JSON editors; keep raw storage/internal JSON out of the normal user path.
- Do not delete, move, print, or commit `.env`, Zotero profiles, data directories, SQLite databases, cookies, or thread histories.
- Public release smoke must not preload `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `DS_COPILOT_EVIDENCE_PROVIDER`, or `DS_COPILOT_EVIDENCE_ENABLED`. If a provider round-trip is needed, enter a temporary key manually in Zotero Settings and clean it afterwards.
- Local `.env` keys are for agent-run real GUI/provider smoke only. They must not become product defaults, release-profile preloads, docs examples, or packaged assets; the normal user path is entering keys in the Zotero Settings UI.
- Do not edit Zotero profile registries, `extensions.json`, or installed extension files by hand to fake acceptance.
- Keep install-chain, host-surface, and provider debugging separate. If Add-ons import is not proven, do not debug Reader/provider behavior.
- Real GUI smoke must follow `docs/zotero-real-smoke-guardrails.md`: one control plane per micro-task, frontmost app/window checks before mutating actions, and a two-strike stop rule.
- Do not change Deepseek Copliot branding, icons, or right-pane surface ownership as a temporary smoke workaround.
- The accepted frontend discovery surface is Zotero's native right-side pane entry in both Library and Reader. Top-toolbar-only discovery, including a truncated `D...` artifact, is a release-blocking host regression.
- Keep write scopes small and respect unrelated working-tree changes. This repo may have user edits in progress.
- Prefer repo patterns and existing services over new abstractions. Add abstractions only when they reduce real duplication or risk.
- When borrowing from a reference project, state what is borrowed, what is explicitly not borrowed, and what local tests or real Zotero smoke will verify it.
- When adding or changing behavior, add focused tests first where feasible, then run the narrow test before the broader gate.

## Verification

Use the smallest meaningful gate first:

- Logic or service changes: focused Vitest, then `npm test`
- Build or release changes: `npm run build:dev:xpi` and `npm run build:release:xpi`
- Packaged artifact changes: inspect `.scaffold/build/addon/manifest.json` and run `npm run verify:xpi`
- Host or Reader changes: packaged `.xpi` smoke in real Zotero, with evidence recorded

`npm run check` includes `privacy:check`; it may fail locally if a private `.env` exists in the workspace. Do not remove the file without explicit user approval.

## Multi-Agent Workflow

Use subagents only for explicit parallel work. Split tasks by disjoint ownership:

- Explorer: read-only code/doc/reference audit
- Worker: bounded implementation with explicit file scope
- Reviewer: verification, risk review, or smoke evidence review

Workers are not alone in the codebase: they must not revert unrelated edits and must adapt to existing changes.

State the lane before editing files. If a request spans multiple lanes, split work into ordered issues unless one acceptance gate truly requires a cross-lane patch.

## Skills

Project-specific Codex skills may exist in a local `.codex/skills/` checkout, but they are not required to live in the public repo. Use them when available and the request matches:

- `zotero-plugin-spec`: spec and issue planning for Zotero plugin changes
- `zotero-native-plugin-install`: native dev XPI import, overwrite, and installed-version proof through Zotero's Plugins/Add-ons manager
- `zotero-real-smoke`: real Zotero packaged smoke and evidence collection
- `zotero-release-manager`: dev/release XPI, manifest, update manifest, and release readiness
