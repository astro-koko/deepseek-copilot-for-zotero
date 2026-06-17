# Zotero Real Smoke Guardrails

This document records the failure modes from real Zotero smoke work and turns them into hard guardrails for future runs.

Use this together with [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md) whenever the work depends on a packaged `.xpi`, a cold restart, native pane validation, icon validation, or real GUI interaction.

## Incident log

### 2026-06-09 real-smoke retrospective

#### Failure 1: frontmost-app drift was not treated as a blocking failure

- What happened:
  repeated GUI actions were attempted while the actual frontmost app had drifted to `Microsoft Edge`, `Codex`, or `Notes` instead of staying on `Zotero`
- Why this wasted time:
  later clicks and key presses did not land on the intended surface, so the run produced noise instead of evidence
- New rule:
  before every mutating GUI action, record the frontmost app and active window title; if either is not the expected Zotero surface, stop and resync before doing anything else

#### Failure 2: multiple automation control planes were mixed inside one micro-task

- What happened:
  `Computer Use`, `osascript`, shell state checks, and coordinate reasoning were mixed while trying to complete the single task of importing the `.xpi`
- Why this wasted time:
  each tool maintained different assumptions about focus, window state, and element identity, so state drift accumulated instead of shrinking
- New rule:
  one micro-task uses one control plane only

Examples:

- opening `Tools -> Plugins`: one control plane
- clicking `Install Plugin From File...`: one control plane
- operating the macOS open panel: one control plane

If a control plane fails twice for the same reason, stop, record the failure, and switch deliberately rather than blending tools mid-stream.

#### Failure 3: repeated same-class failures did not trigger a hard stop

- What happened:
  the same install-menu problem was retried too many times with slightly different clicks and focus assumptions
- Why this wasted time:
  the run kept exploring variants of the same failing path without collecting stronger evidence
- New rule:
  apply a two-strike rule for real GUI smoke

Two strikes means:

- the same surface
- the same goal
- the same class of failure

After two strikes:

- stop the action loop
- collect state
- write down the failure class
- change strategy or return to a narrower prerequisite

#### Failure 4: install-chain debugging and host-surface debugging were not kept separate enough

- What happened:
  time was spent on UI behavior while the install-import step itself had not been cleanly re-proven end to end in the current run
- Why this wasted time:
  without a clean install-chain checkpoint, later host observations were weaker and easier to misread
- New rule:
  real smoke must advance in fixed layers:

1. packaged artifact exists
2. plugin import succeeds
3. Add-ons entry appears
4. settings pane appears
5. Library host appears
6. Reader host appears
7. cold restart reproduces the same path

Do not debug later layers while an earlier layer is still unproven in the current run.

#### Failure 5: icon ownership changes were made too loosely in earlier iterations

- What happened:
  temporary icon changes drifted away from the official DeepSeek look and created visible regressions for the user
- Why this was a serious mistake:
  it changed user-facing branding without strong evidence that the code path required it
- New rule:
  icon changes are never a casual unblock tactic

Before changing any Deepseek Copliot icon path or asset:

1. identify the exact surface that is wrong
2. confirm the expected official asset
3. inspect packaged paths and current cache behavior
4. avoid changing unrelated surfaces
5. verify in real Zotero after packaged install

Do not invent substitute branding during smoke work.

## Required execution guardrails

### 1. Treat real smoke as evidence collection, not live improvisation

Every pass must produce explicit evidence for a layer, not just a feeling that things "seem better".

### 2. Use one control plane per micro-task

Allowed examples:

- only `Computer Use`
- only `osascript`
- only Zotero native menu interaction observed through one automation path

Not allowed:

- open a menu with one tool, click its item with another, then reason about the result using a third tool without first re-establishing state

### 3. Re-establish state before every mutating GUI action

Minimum checkpoint:

- frontmost app
- active window title
- target surface
- planned action

If any checkpoint is unknown, do not click yet.

### 4. Prefer native menu paths over WebView buttons

Order of preference:

1. Zotero native menu bar
2. native dialog controls
3. stable accessibility element actions
4. WebView button clicks
5. coordinate clicking as last resort

### 5. Apply the two-strike rule

Two same-class failures in one layer means stop and switch to evidence collection or a narrower prerequisite.

### 6. Keep install, host, and provider work separate

- Install-chain failure: inspect build, package, import, manifest, cache
- Host-surface failure: inspect startup, registration, mount, native pane ownership
- Provider failure: inspect settings, request path, response handling

Do not jump categories early.

### 6.1. Use the native Add-ons manager for Deepseek Copliot dev imports

Deepseek Copliot development smoke must import the newest local dev, non-stable `.xpi` through Zotero's native Add-ons/Plugins manager via `Install Plugin From File...` / `Install Add-on From File...`.

Do not use Add-on Market / 插件市场 to install or validate Deepseek Copliot. It is a separate marketplace plugin and is not evidence that the locally built development `.xpi` is installed or loaded.

After importing, verify the Add-ons entry or installed XPI manifest version/hash matches the newly built dev package before testing Settings, Library, Reader, or provider behavior. A visible `Deepseek Copliot` Settings pane is not enough evidence that the current build is loaded, because Zotero may still be running an older installed package in the background.

If the package version/hash cannot be proven after import, stop at the install-chain layer. Do not continue into Settings button testing, and do not attribute broken Settings behavior to the new build.

For the Settings `Commands and Prompts` section, record the installed package version/hash before testing any command controls. `Add custom command`, `Restore built-in commands`, JSON validate/preview/apply, and copy prompt are required interactive controls. If they do not respond under the proven latest package, log a Settings-layer bug. The normal Settings UI should show one batch-import JSON editor only; a second visible raw/advanced JSON editor is a UX regression.

### 7. Never change branding as a temporary smoke shortcut

Typography may inherit Zotero host styling.
Brand assets must remain intentional and evidence-backed.

## Real-smoke logging template

Use this table during future acceptance passes.

| Time | Layer | Control plane | Frontmost app | Window | Planned action | Result | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 21:00 | install-chain | osascript | zotero | Plugins Manager | open install menu | pass/fail | ... |

## Next-pass operating plan

For the next real Zotero import attempt:

1. Start from the Zotero main window, not from a stale partially interacted WebView.
2. Re-prove the frontmost app before the first GUI action.
3. Use one control plane to open `Tools -> Plugins`.
4. Use the same control plane to invoke `Install Plugin From File...`.
5. If the install menu fails twice, stop and record the exact failure instead of trying more click variations.
6. Only after the import succeeds do we proceed to Add-ons, Settings, Library, Reader, and cold-restart evidence.
