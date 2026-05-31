# DS Copilot Zotero Dev Smoke Checklist

This repo is developed against a dedicated Zotero profile for fast iteration, but the current daily profile is the formal frontend acceptance environment for host-surface stabilization. We do not patch Zotero itself and we do not hand-edit `extensions.json`.

Use [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md) as the primary development guide and [docs/zotero-doc-index.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-doc-index.md) as the upstream reference map.

## Dev setup

1. Create a local `.env` from `.env.example`.
2. Set `ZOTERO_PLUGIN_ZOTERO_BIN_PATH` to your Zotero executable.
3. Set `ZOTERO_PLUGIN_PROFILE_PATH` to the dedicated dev profile, typically `/absolute/path/to/agentpaper_zotero/.scaffold/profile`.
4. Set `ZOTERO_PLUGIN_DATA_DIR` to the real Zotero data directory you want to smoke test against.
5. Set `DEEPSEEK_API_KEY` for the preferred dev key name, or keep `API_KEY` temporarily if you are still on the older local variable.
6. Set `DEEPSEEK_MODEL` if you want something other than the default `deepseek-v4-flash`.
7. Set `ZOTERO_DEBUGGER=1` only when you need `-ZoteroDebugText` and `-jsdebugger`.

`npm start` uses the scaffold dev server to:
- start Zotero against the dedicated dev profile
- reuse the configured data directory
- install DS Copilot in proxy mode so it is visible in the plugin list
- preload the dev profile with DeepSeek prefs before Zotero starts

`npm start` is only for rapid iteration. A change is not accepted until the built `.xpi` is imported through Zotero's plugin manager and the frontend survives a full Zotero restart.

## Current frontend target

The immediate target is a usable frontend host loop:

1. Add-ons entry exists
2. Settings pane works and persists
3. Library native host is stable
4. Reader native host is stable
5. `Explain` / `Ask...` handoff reaches a usable sidebar flow

Provider quality is secondary until the host loop is stable.

## Smoke gates

1. Run `npm run check`.
2. If you want to inspect the packaged path only, `npm run smoke:xpi` is the shorter preflight.
3. Run `npm start` only if you need a rapid iteration loop before packaged install.
4. Install the built `.xpi` through Zotero's plugin manager.
5. In Zotero, confirm `DS Copilot` appears in the plugin/add-ons list with the new icon.
6. Open Zotero Settings and confirm the `DS Copilot` pane exists.
7. Confirm the settings pane already has a usable API key state and model from the dev-profile preload, or enter a real API key for packaged smoke.
8. Select a real library item and confirm the DS Copilot native right-pane host appears and is visibly correct.
9. Open a real PDF Reader tab and confirm the DS Copilot Reader host appears and is visibly correct.
10. Open Zotero Settings and verify `apiKey`, `model`, and `maxContextBudget` can be edited and persist when you reopen the pane.
11. In Reader, select text and confirm the popup shows `Explain` and `Ask...`.
12. Right-click selected Reader text and confirm `Explain with DS Copilot` and `Ask DS Copilot...` appear.
13. Trigger `Explain` once and confirm the sidebar opens and enters the send flow.
14. Trigger `Ask...` once and confirm the sidebar opens and pre-fills a draft without auto-send.
15. Restart Zotero and re-check plugin list, settings pane, Library host, Reader host, and Reader handoff.

## Runtime evidence

Collect the following facts during host debugging:

- `Zotero_Tabs.selectedType` and `selectedID`
- direct children of `#zotero-item-pane` and `#zotero-context-pane`
- count, parent, display, and dimensions of `ai-assistant-pane-library-mount` and `ai-assistant-pane-reader-mount`
- whether the native pane content is truly hidden when DS Copilot is visible

## Debug signals

When startup diagnostics are visible, the clean startup path is:

- `startup`
- `main-window-load`
- `sidebar-registered`
- `ui-ready`
- `readerIntegration: Registered reader event listeners`

The most useful user-visible checks by layer are:

- Install chain: `DS Copilot` appears in the plugin list.
- Settings registration: a `DS Copilot` pane exists in Zotero Settings.
- Host registration: a DS Copilot native right-pane host exists in library and reader contexts.
- Reader registration: the text-selection popup and right-click menu show DS Copilot actions.
- Handoff connectivity: Reader actions reach the sidebar flow.
- Provider connectivity: sidebar messages return a real model response once the host loop is stable.

Packaged `.xpi` install is the only real acceptance gate. If the plugin is missing from the Add-ons list after `.xpi` install, stop and debug startup/install only. If the plugin is listed but Settings or native hosts are missing, debug registration and mounting before touching DeepSeek code.

## Failure triage

- If `DS Copilot` is missing from the plugin list after `.xpi` install, only inspect the install chain: build output, packaged manifest, addon ID, startup hooks, and import path. Do not debug business logic yet.
- If the plugin is listed but the settings pane or native host is missing, inspect the startup registration chain in `src/hooks.ts`, `src/modules/preferencesPane.ts`, and `src/ui/ui.ts`.
- If the sidebar shell appears with a fallback error, inspect the React bootstrap path in `src/ui/ui.ts`.
- If Reader entry points are missing, inspect `src/modules/readerIntegration.ts` only.
- If Reader menus appear but clicking them does nothing, inspect the event handoff between Reader actions and the sidebar conversation flow before touching provider code.
- If all UI entry points exist but chat fails, inspect only the preloaded prefs, `settingsManager`, provider calls, and the DeepSeek response path.

## Minimal isolation policy

Use minimal isolation only for right-pane or Reader-surface conflict checks.

Isolation order:

1. `Zotero Pdf2zh`
2. `RosettaPDF`
3. `Ethereal Style`
4. any other enabled plugin that modifies right-pane or Reader UI

## Release validation

- Use Zotero's plugin manager to install the built `.xpi` into the dedicated dev profile.
- `npm start` proxy mode is never enough for release acceptance.
- Do not validate releases by copying files into `extensions/` or editing Zotero registry files by hand.
