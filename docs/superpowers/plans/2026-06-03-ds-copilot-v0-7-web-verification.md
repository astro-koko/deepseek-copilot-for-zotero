# Deepseek Copliot v0.7 Web Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v0.7 sidebar/history and web-verification pass by fixing narrow-pane action clipping, renaming the default evidence provider to an MCP/default web-verification contract, and making Tavily settings/dev validation usable end to end.

**Architecture:** Keep the current sidebar and evidence-search flow intact, but introduce a small config helper for dev-profile pref preload, normalize legacy evidence provider values into a new default web-verification mode, and separate visible UI labels from the underlying search transport. Fix the history action truncation at the layout layer instead of changing thread behavior.

**Tech Stack:** TypeScript, React, Vitest, Zotero Plugin Toolkit, Zotero Plugin Scaffold

---

## File Map

- Modify: [src/services/settingsManager.ts](/Users/Liang/project/agentpaper_zotero/src/services/settingsManager.ts)
- Modify: [src/services/evidenceSearch.ts](/Users/Liang/project/agentpaper_zotero/src/services/evidenceSearch.ts)
- Modify: [src/services/chatEngine.ts](/Users/Liang/project/agentpaper_zotero/src/services/chatEngine.ts)
- Modify: [src/modules/preferencesPane.ts](/Users/Liang/project/agentpaper_zotero/src/modules/preferencesPane.ts)
- Modify: [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)
- Modify: [src/ui/components/Composer.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.tsx)
- Modify: [addon/content/preferences.xhtml](/Users/Liang/project/agentpaper_zotero/addon/content/preferences.xhtml)
- Modify: [addon/locale/en-US/preferences.ftl](/Users/Liang/project/agentpaper_zotero/addon/locale/en-US/preferences.ftl)
- Modify: [addon/locale/zh-CN/preferences.ftl](/Users/Liang/project/agentpaper_zotero/addon/locale/zh-CN/preferences.ftl)
- Modify: [addon/prefs.js](/Users/Liang/project/agentpaper_zotero/addon/prefs.js)
- Create: [src/config/devProfilePrefs.ts](/Users/Liang/project/agentpaper_zotero/src/config/devProfilePrefs.ts)
- Modify: [zotero-plugin.config.ts](/Users/Liang/project/agentpaper_zotero/zotero-plugin.config.ts)
- Modify: [src/services/settingsManager.test.ts](/Users/Liang/project/agentpaper_zotero/src/services/settingsManager.test.ts)
- Modify: [src/services/chatEngine.test.ts](/Users/Liang/project/agentpaper_zotero/src/services/chatEngine.test.ts)
- Modify: [src/modules/preferencesPane.test.ts](/Users/Liang/project/agentpaper_zotero/src/modules/preferencesPane.test.ts)
- Modify: [src/ui/components/Composer.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.test.tsx)
- Create: [src/config/devProfilePrefs.test.ts](/Users/Liang/project/agentpaper_zotero/src/config/devProfilePrefs.test.ts)
- Modify: [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- Modify: [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- Modify: [.env.example](/Users/Liang/project/agentpaper_zotero/.env.example)
- Modify: [.env](/Users/Liang/project/agentpaper_zotero/.env)

## Task 1: Lock The v0.7 Contract In Tests

**Files:**
- Modify: [src/services/settingsManager.test.ts](/Users/Liang/project/agentpaper_zotero/src/services/settingsManager.test.ts)
- Modify: [src/services/chatEngine.test.ts](/Users/Liang/project/agentpaper_zotero/src/services/chatEngine.test.ts)
- Modify: [src/modules/preferencesPane.test.ts](/Users/Liang/project/agentpaper_zotero/src/modules/preferencesPane.test.ts)
- Modify: [src/ui/components/Composer.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.test.tsx)
- Create: [src/config/devProfilePrefs.test.ts](/Users/Liang/project/agentpaper_zotero/src/config/devProfilePrefs.test.ts)

- [ ] Add failing tests for:
  - legacy `builtin-search` normalizes to the new default provider mode
  - evidence audit copy uses the new default label instead of `OpenAlex`
  - composer footer no longer renders `OpenAlex`
  - preferences pane persists the renamed default provider value
  - dev-profile prefs include DeepSeek and Tavily env-backed values
- [ ] Run:

```bash
npm test -- src/services/settingsManager.test.ts src/services/chatEngine.test.ts src/modules/preferencesPane.test.ts src/ui/components/Composer.test.tsx src/config/devProfilePrefs.test.ts
```

Expected:
- failures that prove the old provider names and missing dev-pref helper still exist

## Task 2: Implement Provider Normalization And Settings Copy

**Files:**
- Modify: [src/services/settingsManager.ts](/Users/Liang/project/agentpaper_zotero/src/services/settingsManager.ts)
- Modify: [src/services/evidenceSearch.ts](/Users/Liang/project/agentpaper_zotero/src/services/evidenceSearch.ts)
- Modify: [src/services/chatEngine.ts](/Users/Liang/project/agentpaper_zotero/src/services/chatEngine.ts)
- Modify: [src/modules/preferencesPane.ts](/Users/Liang/project/agentpaper_zotero/src/modules/preferencesPane.ts)
- Modify: [addon/content/preferences.xhtml](/Users/Liang/project/agentpaper_zotero/addon/content/preferences.xhtml)
- Modify: [addon/locale/en-US/preferences.ftl](/Users/Liang/project/agentpaper_zotero/addon/locale/en-US/preferences.ftl)
- Modify: [addon/locale/zh-CN/preferences.ftl](/Users/Liang/project/agentpaper_zotero/addon/locale/zh-CN/preferences.ftl)
- Modify: [addon/prefs.js](/Users/Liang/project/agentpaper_zotero/addon/prefs.js)

- [ ] Rename the default provider mode to an MCP/default web-verification identifier with backward normalization from `builtin-search`.
- [ ] Replace visible `OpenAlex` labels with source-agnostic evidence UI copy and a default provider audit label.
- [ ] Keep Tavily validation behavior, but make the default provider path clearly no-config in settings copy.
- [ ] Re-run the focused suite from Task 1 and verify it turns green.

## Task 3: Fix Narrow Sidebar Action Layout And Composer Labels

**Files:**
- Modify: [src/ui/components/Sidebar.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Sidebar.tsx)
- Modify: [src/ui/components/Composer.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.tsx)
- Modify: [src/ui/components/Composer.test.tsx](/Users/Liang/project/agentpaper_zotero/src/ui/components/Composer.test.tsx)

- [ ] Convert thread action rows to a width-stable two-column layout so export/delete remain fully visible in narrow panes.
- [ ] Make the composer evidence button label source-agnostic while preserving the enabled/disabled state logic.
- [ ] Re-run:

```bash
npm test -- src/ui/components/Composer.test.tsx src/ui/components/sidebarViewModel.test.ts src/ui/ui.test.ts
```

Expected:
- all targeted UI tests pass

## Task 4: Preload Dev Prefs And Document The Smoke Loop

**Files:**
- Create: [src/config/devProfilePrefs.ts](/Users/Liang/project/agentpaper_zotero/src/config/devProfilePrefs.ts)
- Create: [src/config/devProfilePrefs.test.ts](/Users/Liang/project/agentpaper_zotero/src/config/devProfilePrefs.test.ts)
- Modify: [zotero-plugin.config.ts](/Users/Liang/project/agentpaper_zotero/zotero-plugin.config.ts)
- Modify: [.env.example](/Users/Liang/project/agentpaper_zotero/.env.example)
- Modify: [.env](/Users/Liang/project/agentpaper_zotero/.env)
- Modify: [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
- Modify: [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)

- [ ] Add a dev-profile prefs helper that maps `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `TAVILY_API_KEY`, `DS_COPILOT_EVIDENCE_PROVIDER`, and `DS_COPILOT_EVIDENCE_ENABLED` into Zotero pref keys.
- [ ] Wire the helper into scaffold `server.prefs` so `npm start` preloads the dedicated profile.
- [ ] Add Tavily variables to `.env.example` and the provided real key to `.env`.
- [ ] Update smoke docs so the v0.7 settings contract includes default web verification plus optional Tavily validation.

## Task 5: Run Fresh Verification

**Files:**
- No additional code changes unless verification exposes a regression

- [ ] Run the full relevant suite:

```bash
npm test -- src/services/settingsManager.test.ts src/services/chatEngine.test.ts src/modules/preferencesPane.test.ts src/ui/components/Composer.test.tsx src/config/devProfilePrefs.test.ts src/ui/components/sidebarViewModel.test.ts src/ui/ui.test.ts
```

- [ ] Run the build:

```bash
npm run build
```

- [ ] Run a live Tavily validation request using the `.env` key and confirm a success response.
- [ ] If any verification fails, make the smallest aligned fix and rerun the exact failing command before expanding scope again.
