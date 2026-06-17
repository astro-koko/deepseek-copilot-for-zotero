---
name: zotero-native-plugin-install
description: Use when importing, overwriting, or verifying a locally built Deepseek Copliot dev XPI through Zotero's native Plugins/Add-ons manager, especially when the install chain is flaky, the file picker cannot reach the build output, UI surfaces may be stale, or GUI debugging must stop until the installed version is proven.
---

# Zotero Native Plugin Install

## Overview

Use this skill to keep Zotero smoke disciplined: prove the built package, install only through Zotero's native `Install Plugin From File...` path, and block all UI debugging until the installed Deepseek Copliot version is confirmed.

## Required Reads

Read these before action:

- `AGENTS.md`
- `docs/zotero-real-smoke-guardrails.md`
- `docs/zotero-dev-smoke-checklist.md`
- `docs/zotero-dev-workbench.md`
- `.codex/skills/zotero-real-smoke/SKILL.md`

If the package itself may be stale, also read:

- `zotero-plugin.config.ts`
- `scripts/verify-build-artifact.mjs`
- `scripts/verify-build-artifact-lib.mjs`

## Hard Rules

- Use Zotero's native path only: `工具 -> 插件`, then the gear menu, then `Install Plugin From File...`.
- Do not use Add-on Market / 插件市场 to install or validate Deepseek Copliot.
- Use one control plane per micro-task. Do not mix shell, browser automation, and GUI clicking in the same mutation step.
- Stop after two same-class failures in the same layer and collect evidence.
- Treat Settings, Library pane, Reader pane, provider calls, and restart behavior as later layers. Do not debug them before the Add-ons entry proves the new package is installed.
- Do not hand-edit `extensions.json`, installed extension folders, or other Zotero profile registries to fake success.
- If Zotero shows a suspicious popup like `External App undefined wants to execute command...`, choose `Cancel` unless the exact action was intentionally triggered and fully understood.

## Layer Order

Prove each layer in order:

1. latest dev XPI exists
2. manifest version and hash are known
3. Zotero Plugins/Add-ons window is open
4. native file import completes
5. Add-ons entry for `Deepseek Copliot` shows the new version
6. only then inspect Settings, sidebar, Reader, or provider behavior

## Stable Install Procedure

1. Record the XPI path, manifest `version`, manifest `version_name`, addon id, and SHA-256.
2. Bring Zotero frontmost and confirm the active window before clicking.
3. Open `工具 -> 插件`.
4. In the Plugins/Add-ons window, open the gear menu and choose `Install Plugin From File...`.
5. In the native open panel, select the exact XPI. If `.scaffold/build` is awkward to reach, first copy the same XPI to `~/Downloads/` and install that copy through the same native Zotero dialog.
6. Finish the import and wait for Zotero to update the Add-ons entry.
7. Verify the visible `Deepseek Copliot` entry version matches the recorded build before touching any other product surface.

## Failure Classes

Classify the failure before retrying:

- `artifact-stale`: build output version/hash does not match expectation
- `window-access`: cannot open or focus Zotero Plugins/Add-ons window
- `picker-access`: native file picker cannot reach or select the XPI
- `import-failed`: Zotero rejects the file or shows install failure
- `version-stale`: Add-ons entry still shows the old version after import
- `popup-risk`: unexpected external-app or command-execution prompt appears

After two failures in the same class, stop and report the layer, failure class, last attempted action, and captured evidence.

## Evidence Checklist

For every install attempt, capture:

- XPI absolute path
- manifest `version`, `version_name`, addon id
- SHA-256
- Zotero version and profile class
- whether installation used build folder directly or a copied file in `~/Downloads/`
- Add-ons entry screenshot or equivalent GUI note showing installed version
- the next layer that is now safe to test

## Deepseek Copliot Reminders

- The installed plugin name to verify is `Deepseek Copliot`.
- A visible Settings pane alone does not prove the current build is running.
- If the Add-ons entry is stale, treat every downstream UI symptom as untrusted until the install chain is fixed.
