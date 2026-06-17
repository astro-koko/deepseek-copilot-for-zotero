# Zotero Development Doc Index

Use this file to decide what to read before changing Deepseek Copliot.

## Current execution docs

For the current project-management baseline, start here first:

- [docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md)
- [docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md)
- [docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [docs/superpowers/plans/2026-06-16-ds-copilot-debug-observability-task-board.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-06-16-ds-copilot-debug-observability-task-board.md)
- [docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- [docs/zotero-sidebar-stability-review.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-sidebar-stability-review.md)

These files define the immediate execution target:

- host-first frontend stabilization
- privacy-safe debug observability for user issue triage
- Reader session isolation across multiple active PDF tabs
- daily-profile acceptance for host surfaces
- packaged `.xpi` plus restart as the real gate

## Host and version baseline

- Current daily target: Zotero 9 release
- Compatibility target: Zotero 10 beta
- Keep [addon/manifest.json](/Users/Liang/project/agentpaper_zotero/addon/manifest.json) at `strict_max_version: "9.*"` until a packaged Zotero 10 beta smoke succeeds.

Reference snapshots:
- [reference/upstream-docs/zotero/zotero-7-for-developers.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/zotero/zotero-7-for-developers.md)
- [reference/upstream-docs/zotero/zotero-8-for-developers.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/zotero/zotero-8-for-developers.md)
- [reference/upstream-docs/zotero/zotero-beta-builds.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/zotero/zotero-beta-builds.md)

## Question -> Where to look

### Plugin startup, lifecycle, shutdown

Read:
- Zotero 7/8 developer docs for startup and localization rules
- [reference/upstream-docs/tooling/zotero-plugin-template-readme.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-template-readme.md)
- [reference/upstream-docs/tooling/zotero-plugin-dev-docs-index.html](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-dev-docs-index.html)

Then inspect:
- [addon/bootstrap.js](/Users/Liang/project/agentpaper_zotero/addon/bootstrap.js)
- [src/hooks.ts](/Users/Liang/project/agentpaper_zotero/src/hooks.ts)
- [src/utils/startupDiagnostics.ts](/Users/Liang/project/agentpaper_zotero/src/utils/startupDiagnostics.ts)

### Preferences pane and settings persistence

Read:
- `Preferences` sections in the template README snapshot
- [reference/upstream-docs/tooling/zotero-plugin-dev-docs-index.html](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-dev-docs-index.html)

Then inspect:
- [addon/content/preferences.xhtml](/Users/Liang/project/agentpaper_zotero/addon/content/preferences.xhtml)
- [addon/prefs.js](/Users/Liang/project/agentpaper_zotero/addon/prefs.js)
- [src/services/settingsManager.ts](/Users/Liang/project/agentpaper_zotero/src/services/settingsManager.ts)

### Item pane section, Library sidebar, Reader sidebar shell

Read:
- `registerReaderItemPaneSection` and related UI examples in the template snapshot
- Beaver Reader/sidebar references from the tracked `reference/beaver-zotero`

Then inspect:
- [src/ui/ui.ts](/Users/Liang/project/agentpaper_zotero/src/ui/ui.ts)
- [src/ui/sidebarSection.ts](/Users/Liang/project/agentpaper_zotero/src/ui/sidebarSection.ts)
- [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)
- [reference/beaver-zotero/react/hooks/useReaderSelectionActionHandler.ts](/Users/Liang/project/agentpaper_zotero/reference/beaver-zotero/react/hooks/useReaderSelectionActionHandler.ts)

### Reader popup, Reader right-click actions, selection handoff

Read:
- template menu and reader examples
- Beaver Reader selection flow

Then inspect:
- [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/src/modules/readerIntegration.ts)
- [src/ui/readerActionFlow.ts](/Users/Liang/project/agentpaper_zotero/src/ui/readerActionFlow.ts)
- [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)

### Build, hot reload, XPI packaging

Read:
- [reference/upstream-docs/tooling/zotero-plugin-scaffold-build.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-scaffold-build.md)
- [reference/upstream-docs/tooling/zotero-plugin-scaffold-config.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-scaffold-config.md)
- [reference/upstream-docs/tooling/zotero-plugin-template-readme.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-template-readme.md)

Then inspect:
- [zotero-plugin.config.ts](/Users/Liang/project/agentpaper_zotero/zotero-plugin.config.ts)
- [scripts/verify-build-artifact.mjs](/Users/Liang/project/agentpaper_zotero/scripts/verify-build-artifact.mjs)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)

### Menu injection and XUL host behavior

Read:
- template README examples for menus
- `reference/beaver-zotero/src/hooks.ts`

Then inspect:
- [src/modules/readerIntegration.ts](/Users/Liang/project/agentpaper_zotero/src/modules/readerIntegration.ts)
- [src/hooks.ts](/Users/Liang/project/agentpaper_zotero/src/hooks.ts)

## Reference projects and when to copy patterns

- `reference/upstream-docs`
  - default source for official docs, scaffold docs, toolkit docs, and minimal examples
- `reference/beaver-zotero`
  - default source for Reader-to-sidebar orchestration and richer Zotero-native interaction flow
- `reference/aidea-zotero`
  - source for alternative context-panel patterns when comparing library and reader surfaces

## Local acceptance docs

- [docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/specs/2026-05-31-ds-copilot-host-first-frontend-design.md)
- [docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-06-16-ds-copilot-debug-observability-workflow-design.md)
- [docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md](/Users/Liang/project/agentpaper_zotero/docs/superpowers/plans/2026-05-31-ds-copilot-host-first-frontend-task-board.md)
- [docs/superpowers/plans/2026-06-16-ds-copilot-debug-observability-task-board.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-06-16-ds-copilot-debug-observability-task-board.md)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- [docs/zotero-sidebar-stability-review.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-sidebar-stability-review.md)
