# Deepseek Copliot Zotero Dev Smoke Checklist

This repo is developed against a dedicated Zotero profile for fast iteration, but the current daily profile is the formal frontend acceptance environment for host-surface stabilization. We do not patch Zotero itself and we do not hand-edit `extensions.json`.

Use [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md) as the primary development guide and [docs/zotero-doc-index.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-doc-index.md) as the upstream reference map.

Before any real packaged import or cold-restart acceptance pass, read [docs/zotero-real-smoke-guardrails.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-real-smoke-guardrails.md). It records prior mistakes from real Zotero smoke work and defines the hard stop rules for GUI automation, install-chain proof, and icon ownership.

## Dev setup

1. Create a local `.env` from `.env.example`.
2. Set `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` to your Zotero executable.
3. Set `ZOTERO_PLUGIN_PROFILE_PATH` to the dedicated dev profile, typically `/absolute/path/to/agentpaper_zotero/.scaffold/profile`.
4. Set `ZOTERO_PLUGIN_DATA_DIR` to the real Zotero data directory you want to smoke test against.
5. Set `DEEPSEEK_API_KEY` for the preferred dev key name, or keep `API_KEY` temporarily if you are still on the older local variable.
6. Set `DEEPSEEK_MODEL` if you want something other than the default `deepseek-v4-flash`.
7. Set `TAVILY_API_KEY` if you want Tavily-backed web verification available in the dev profile.
8. Optionally set `DS_COPILOT_EVIDENCE_PROVIDER` to `mcp-web-search` or `tavily`, and `DS_COPILOT_EVIDENCE_ENABLED=1` if you want the composer toggle pre-enabled in dev.
9. Set `ZOTERO_DEBUGGER=1` only when you need `-ZoteroDebugText` and `-jsdebugger`.

`npm start` uses the scaffold dev server to:

- start Zotero against the dedicated dev profile
- reuse the configured data directory
- install Deepseek Copliot in proxy mode so it is visible in the plugin list
- preload the dev profile with DeepSeek and optional evidence-search prefs before Zotero starts

`npm start` is only for rapid iteration. A change is not accepted until the built `.xpi` is imported through Zotero's plugin manager and the frontend survives a full Zotero restart.

## Public GitHub release smoke

公开 GitHub release 不要复用开发期 profile，也不要把本地 `.env` 里的 key 预灌进 smoke 环境。

推荐约束：

1. 使用一个全新的 clean profile，例如 `/absolute/path/to/agentpaper_zotero/.scaffold/release-profile`。
2. 同时使用一个全新的 Zotero data directory；如果继续指向你原来的 `extensions.zotero.dataDir`，插件最近会话仍会从同一套 Zotero 数据库里读出来。
3. 公开 release smoke 时不要设置 `DEEPSEEK_API_KEY`、`TAVILY_API_KEY`、`DS_COPILOT_EVIDENCE_PROVIDER`、`DS_COPILOT_EVIDENCE_ENABLED`。
4. 不要复用 `.scaffold/profile`、`.scaffold/dev-profile`、现有 `Zotero` 日常 profile，或任何已有 `threads` 数据库。
5. 先安装打包出来的 `.xpi`，确认设置页默认不会带出你的本地 API key，也不会显示旧测试会话。
6. 如果需要验证真实 provider round-trip，再在 Zotero Settings 里手动录入临时测试 key，并在 smoke 后清理。

## Current frontend target

The immediate target is a usable frontend host loop:

1. Add-ons entry exists
2. Settings pane works and persists
3. Library native host is stable
4. Reader native host is stable
5. `Explain` / `Ask...` handoff reaches a usable sidebar flow

Provider quality is secondary until the host loop is stable.

## Current verified state

- `Settings` is visible again and no longer blank in the daily profile.
- the user-facing settings form is now being simplified in code to `API Key` only.
- Reader scope now resolves from the active PDF tab instead of stale Reader context.
- the sidebar shell can mount in Reader and show the expected shell chrome.
- the Reader composer now accepts typed input and unlocks `Send`.
- clicking `Send` now clears the draft, so the frontend interaction path is live.
- first-message persistence failures now surface through session error state in tests instead of failing silently.
- the top-toolbar `D...` fallback path has been removed from the primary host design and should now be treated as a regression if it reappears.
- 2026-06-02 packaged smoke passed on the daily profile after a cold Zotero restart: startup reached `main-window-load`, `sidebar-registered`, and `ui-ready`, and the `Deepseek Copliot` native right-pane section was visible again in Library.
- 2026-06-02 packaged smoke also confirmed Markdown rendering in a real restored thread: headings, bullet lists, ordered lists, inline emphasis, fenced code text, and links rendered in the sidebar instead of showing raw Markdown.

## Current blockers

- `Settings` still needs edit/save/reopen validation in the daily profile and restart validation in packaged smoke.
- the v0.7 evidence contract still needs packaged smoke confirmation for both `默认联网查证` and `Tavily` configuration paths.
- `Library` still needs explicit daily-profile verification on both regular items and PDF attachment items.
- manual send still does not settle into a visible thread/response state, even though the draft clears.
- packaged Zotero smoke still needs explicit confirmation that Deepseek Copliot is discoverable only through the native right-side pane entry in both Library and Reader.

## What To Record In The Next Smoke Pass

Treat the next smoke run as an evidence-collection pass, not a vibe check. Capture explicit pass/fail notes for:

1. Settings edit, save, reopen, and packaged-restart persistence for the current DeepSeek + web-verification contract.
2. confirmation that the evidence provider radio shows `默认联网查证（推荐）` and `Tavily 联网查证`, with no visible `OpenAlex` wording.
3. Library native-host behavior on one regular item and one PDF attachment item.
4. Reader native-host behavior after switching between at least two PDF tabs.
5. `Explain` auto-send behavior plus post-handoff interactivity.
6. `Ask...` prefill-only behavior plus post-handoff interactivity.
7. manual send behavior: does it create a visible active thread or silently clear the draft.
8. whether the observed surface was reached through the native right-side pane entry in both Library and Reader, with no truncated top-toolbar artifact.

## Smoke gates

1. Run `npm run check`.
2. If you want to inspect the packaged path only, `npm run smoke:xpi` is the shorter preflight.
3. Run `npm start` only if you need a rapid iteration loop before packaged install.
4. Install the newest local dev, non-stable `.xpi` through Zotero's native plugin manager with `Install Plugin From File...`; do not use Add-on Market / 插件市场 for Deepseek Copliot validation.
5. Confirm the installed Add-ons entry or installed XPI manifest version/hash matches the newly built dev package before testing Settings or host behavior.
6. In Zotero, confirm `Deepseek Copliot` appears in the plugin/add-ons list with the new icon.
7. Open Zotero Settings and confirm the `Deepseek Copliot` pane exists.
8. Confirm the settings pane already has a usable API key state from the dev-profile preload, or enter a real API key for packaged smoke.
9. Select a real library item and confirm the Deepseek Copliot native right-pane host appears, is visibly correct, and still uses the Deepseek Copliot branded icon rather than a generic Zotero document icon.
10. Open a real PDF Reader tab and confirm the Deepseek Copliot Reader host appears, uses the active tab scope, and keeps the same branded Deepseek Copliot entry icon in the right-side surface.
11. Open Zotero Settings and verify the DeepSeek `API key`, evidence provider, and optional Tavily key can be edited, saved, and persisted when you reopen the pane.
12. If `Tavily` is selected, run the built-in Tavily validation button and record the result.
13. In Reader, select text and confirm the popup shows `Explain` and `Ask...`.
14. Right-click selected Reader text and confirm `Explain with Deepseek Copliot` and `Ask Deepseek Copliot...` appear.
15. Trigger `Explain` once and confirm the sidebar opens and enters the send flow.
16. Trigger `Ask...` once and confirm the sidebar opens and pre-fills a draft without auto-send.
17. Type a manual message in Reader and verify whether `Send` creates a visible active thread.
18. Restart Zotero and re-check plugin list, settings pane, Library host, Reader host, and Reader handoff.
19. Treat any top-toolbar-only discovery, including a truncated `D...` artifact, as a release-blocking surface regression.
20. For public release smoke, confirm the clean profile starts without prefilled API keys and without restored test threads before entering any temporary credentials.
21. If a packaged icon change does not show up after reinstall, clear the profile-level add-on startup cache such as `addonStartup.json.lz4`, cold-restart Zotero, and then re-check the Library and Reader surfaces before changing code again.

For `Commands and Prompts` validation, do not start from a currently visible Settings pane unless step 5 has just proven the newest dev XPI is loaded. Treat the slash card editor as the product requirement: built-in cards must render under `默认命令`, custom cards must render under `我的命令`, `新增命令` must create a blank editable card, leaving a valid card must auto-save, leaving an empty new card must discard it, duplicate slash tokens must show inline validation without silent save, `恢复默认` must remove a built-in override, and save/reopen plus packaged-restart persistence must keep the edited title/slash/prompt values. The normal Settings UI must not expose JSON import, preview, raw-storage, copy-prompt, or GitHub JSON-example actions.

## Runtime evidence

Collect the following facts during host debugging:

- `Zotero_Tabs.selectedType` and `selectedID`
- direct children of `#zotero-item-pane` and `#zotero-context-pane`
- count, parent, display, and dimensions of `ai-assistant-pane-library-mount` and `ai-assistant-pane-reader-mount`
- whether the native pane content is truly hidden when Deepseek Copliot is visible

Still-missing evidence for the current branch:

- a captured Settings round-trip result after reopen
- a captured implementation pass that keeps user-facing evidence settings aligned with the v0.7 contract
- a captured real-Zotero confirmation that first-message failures are now visible inline
- a captured packaged `.xpi` restart result
- a captured Library pass on both regular and attachment items
- a captured post-handoff interactivity result for `Explain` and `Ask...`
- a captured manual-send result that either shows a real active thread or explains why it fails

## Debug signals

When startup diagnostics are visible, the clean startup path is:

- `startup`
- `main-window-load`
- `sidebar-registered`
- `ui-ready`
- `readerIntegration: Registered reader event listeners`

The most useful user-visible checks by layer are:

- Install chain: `Deepseek Copliot` appears in the plugin list.
- Settings registration: a `Deepseek Copliot` pane exists in Zotero Settings.
- Host registration: a Deepseek Copliot native right-pane host exists in library and reader contexts.
- Icon ownership: Deepseek Copliot-owned entry points such as Add-ons, Settings, and the native right-side pane entry keep Deepseek Copliot branding; only typography/layout should inherit Zotero host styling.
- Reader scope signal: the active PDF tab, not a stale prior tab, determines the visible Reader scope.
- Reader registration: the text-selection popup and right-click menu show Deepseek Copliot actions.
- Handoff connectivity: Reader actions reach the sidebar flow.
- Provider connectivity: sidebar messages return a real model response once the host loop is stable.

Packaged `.xpi` install is the only real acceptance gate. If the plugin is missing from the Add-ons list after `.xpi` install, stop and debug startup/install only. If the plugin is listed but Settings or native hosts are missing, debug registration and mounting before touching DeepSeek code.

## Failure triage

- If `Deepseek Copliot` is missing from the plugin list after `.xpi` install, only inspect the install chain: build output, packaged manifest, addon ID, startup hooks, and import path. Do not debug business logic yet.
- If the plugin is listed but the settings pane or native host is missing, inspect the startup registration chain in `src/hooks.ts`, `src/modules/preferencesPane.ts`, and `src/ui/ui.ts`.
- If the plugin is listed and the pane exists but the Deepseek Copliot icon looks generic or disappears, inspect the icon ownership chain in `src/hooks.ts`, `src/ui/ui.ts`, packaged icon assets, and then rule out stale `addonStartup.json.lz4` before changing business logic.
- If the sidebar shell appears with a fallback error, inspect the React bootstrap path in `src/ui/ui.ts`.
- If Reader entry points are missing, inspect `src/modules/readerIntegration.ts` only.
- If Reader menus appear but clicking them does nothing, inspect the event handoff between Reader actions and the sidebar conversation flow before touching provider code.
- If all UI entry points exist but chat fails, inspect only the preloaded prefs, `settingsManager`, provider calls, and the DeepSeek response path.
- If a top-toolbar `D...` or other truncated Deepseek Copliot artifact appears, treat it as a surface ownership regression in `src/ui/ui.ts` before debugging provider or Reader logic.

## Minimal isolation policy

Use minimal isolation only for right-pane or Reader-surface conflict checks.

Isolation order:

1. `Zotero Pdf2zh`
2. `RosettaPDF`
3. `Ethereal Style`
4. any other enabled plugin that modifies right-pane or Reader UI

## Release validation

- Use Zotero's plugin manager to install the built `.xpi` into the dedicated dev profile.
- For public GitHub release validation, switch to a separate clean profile such as `.scaffold/release-profile` instead of the dev profile.
- `npm start` proxy mode is never enough for release acceptance.
- Do not validate releases by copying files into `extensions/` or editing Zotero registry files by hand.
- The acceptance surface is the native right-side Zotero pane entry in Library and Reader; any toolbar-only Deepseek Copliot entry fails release UX acceptance.
- Do not preload API keys or old thread history into the public release smoke profile.
