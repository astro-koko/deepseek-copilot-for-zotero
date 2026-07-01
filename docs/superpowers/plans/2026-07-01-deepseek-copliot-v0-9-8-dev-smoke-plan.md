# Deepseek Copliot v0.9.8 Dev Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify a v0.9.8 dev XPI before any formal v0.9.8 release, with Zotero 7/8/9 fresh smoke explicitly waived by the user and Zotero 10 beta kept as the hard packaged-smoke target.

**Architecture:** Use the clean `release/v0.9.8-dev-smoke` worktree from `origin/main` as the only release-candidate source. First run deterministic Node/package gates, then record a versioned smoke log, then run real Zotero 10 beta packaged install and restart smoke. Formal tagging remains out of scope until the scoped dev-smoke gate is recorded as passing.

**Tech Stack:** Node.js LTS, npm, Vitest, TypeScript, `zotero-plugin-scaffold`, packaged `.xpi`, Zotero 10 beta, GitHub CLI.

---

## File Map

- Read: `docs/superpowers/specs/2026-07-01-deepseek-copliot-v0-9-8-dev-smoke-design.md`
- Create: `docs/community/v0.9.8-smoke-log.md`
- Modify: `docs/superpowers/plans/2026-07-01-deepseek-copliot-v0-9-8-dev-smoke-plan.md`
- Inspect generated files only: `.scaffold/build/*.xpi`, `.scaffold/build/addon/manifest.json`, `.scaffold/build/update.json`
- Do not modify unless a later focused fix is approved: `package.json`, `package-lock.json`, `addon/manifest.json`, `zotero-plugin.config.ts`, `src/**`

### Task 1: Confirm Release Candidate Baseline

**Files:**

- Read: `package.json`
- Read: `addon/manifest.json`
- Read: `docs/superpowers/specs/2026-07-01-deepseek-copliot-v0-9-8-dev-smoke-design.md`

- [ ] **Step 1: Verify current branch and cleanliness**

Run:

```bash
git status --short --branch
```

Expected: output starts with:

```text
## release/v0.9.8-dev-smoke...origin/main
```

There must be no uncommitted files after the branch line before build gates start.

- [ ] **Step 2: Verify release candidate version**

Run:

```bash
node -e 'const pkg=require("./package.json"); console.log(pkg.version)'
```

Expected:

```text
0.9.8
```

- [ ] **Step 3: Verify source manifest compatibility**

Run:

```bash
node -e 'const m=require("./addon/manifest.json"); console.log(JSON.stringify(m.applications.zotero))'
```

Expected:

```json
{
  "id": "__addonID__",
  "update_url": "__updateURL__",
  "strict_min_version": "7.0",
  "strict_max_version": "10.*"
}
```

- [ ] **Step 4: Confirm v0.9.8 is not already public**

Run:

```bash
gh release view v0.9.8 --json tagName,url
```

Expected:

```text
release not found
```

If a release exists, stop and inspect whether the goal has already changed.

### Task 2: Create Smoke Log Skeleton

**Files:**

- Create: `docs/community/v0.9.8-smoke-log.md`

- [ ] **Step 1: Create the smoke log**

Create `docs/community/v0.9.8-smoke-log.md` with this exact starting content:

```markdown
# Deepseek Copliot v0.9.8 Dev Smoke Log

Status: In progress
Branch: `release/v0.9.8-dev-smoke`
Source baseline: `origin/main`
Public fallback release: `v0.9.7`
Formal v0.9.8 release: not published

## Build Evidence

| Gate                  | Command                                                                                   | Result  | Notes |
| --------------------- | ----------------------------------------------------------------------------------------- | ------- | ----- |
| dependency install    | `npm ci`                                                                                  | pending |       |
| test suite            | `npm test`                                                                                | pending |       |
| dev XPI build         | `npm run build:dev:xpi`                                                                   | pending |       |
| artifact verification | `DS_COPILOT_BUILD_CHANNEL=dev DS_COPILOT_DEV_NUMBER=<recorded-number> npm run verify:xpi` | pending |       |
| manifest inspection   | `unzip -p "$XPI_PATH" manifest.json`                                                      | pending |       |
| hash capture          | `shasum -a 256 "$XPI_PATH" .scaffold/build/update.json`                                   | pending |       |

## Environment Discovery

| Target         | Expected role         | Local app/binary | Exact version/build | Result  |
| -------------- | --------------------- | ---------------- | ------------------- | ------- |
| Zotero 7       | compatibility floor   | pending          | pending             | pending |
| Zotero 8       | compatibility bridge  | pending          | pending             | pending |
| Zotero 9       | current stable target | pending          | pending             | pending |
| Zotero 10 beta | compatibility beta    | pending          | pending             | pending |

## Packaged Smoke Matrix

This scoped run keeps Zotero 10 beta as the only required packaged-smoke gate. Zotero 7, 8, and 9 fresh smoke were user-waived on 2026-07-01 because those plugin paths are already considered working; v0.9.7 remains the public fallback.

The required Zotero 10 beta target must record: XPI path, XPI hash, packaged manifest, Add-ons entry, Settings pane, Library right pane, Reader right pane, Reader actions, cold restart repeat, and notes.

| Target         | Install chain | Settings    | Library     | Reader      | Reader actions | Restart repeat | Result      |
| -------------- | ------------- | ----------- | ----------- | ----------- | -------------- | -------------- | ----------- |
| Zotero 7       | user-waived   | user-waived | user-waived | user-waived | user-waived    | user-waived    | user-waived |
| Zotero 8       | user-waived   | user-waived | user-waived | user-waived | user-waived    | user-waived    | user-waived |
| Zotero 9       | user-waived   | user-waived | user-waived | user-waived | user-waived    | user-waived    | user-waived |
| Zotero 10 beta | pending       | pending     | pending     | pending     | pending        | pending        | pending     |

## Release Decision

- Do not tag `v0.9.8` while Zotero 10 beta is pending or failed.
- Zotero 7/8/9 fresh smoke is user-waived for this run; do not describe those rows as newly passed by this smoke.
- Keep `v0.9.7` as latest public release until Zotero 10 beta passes and a separate formal v0.9.8 release plan is accepted.
```

- [ ] **Step 2: Commit the smoke log skeleton**

Run:

```bash
git add docs/community/v0.9.8-smoke-log.md
git commit -m "docs: add v0.9.8 dev smoke log"
```

Expected: commit succeeds and only the smoke log is included.

### Task 3: Run Automated Build Gates

**Files:**

- Modify: `docs/community/v0.9.8-smoke-log.md`
- Inspect generated: `.scaffold/build/*.xpi`
- Inspect generated: `.scaffold/build/update.json`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm ci
```

Expected: command exits `0`.

Then update the smoke log row:

```markdown
| dependency install | `npm ci` | pass | exited 0 |
```

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected: command exits `0`.

Then update the smoke log row:

```markdown
| test suite | `npm test` | pass | exited 0 |
```

- [ ] **Step 3: Build the dev XPI**

Run:

```bash
npm run build:dev:xpi
```

Expected: command exits `0`.

Then run:

```bash
ls -1 .scaffold/build/Deepseek.Copliot-0.9.8-dev.*.xpi
```

Expected: at least one path prints and every printed path starts with:

```text
.scaffold/build/Deepseek.Copliot-0.9.8-dev.
```

Then update the smoke log row with the exact XPI path.

- [ ] **Step 4: Capture the dev build number**

Run:

```bash
XPI_PATH="$(ls -1 .scaffold/build/Deepseek.Copliot-0.9.8-dev.*.xpi | tail -1)"
DEV_NUMBER="${XPI_PATH##*.dev.}"
DEV_NUMBER="${DEV_NUMBER%.xpi}"
printf '%s\n' "$DEV_NUMBER"
```

Expected: a numeric build number such as:

```text
261820920
```

Then keep `DEV_NUMBER` for the next step.

- [ ] **Step 5: Verify the dev XPI artifact with matching dev environment**

Run:

```bash
DS_COPILOT_BUILD_CHANNEL=dev DS_COPILOT_DEV_NUMBER="$DEV_NUMBER" npm run verify:xpi
```

Expected: command exits `0` and prints:

```text
Packaged addon artifacts verified.
```

Then update the smoke log row with the exact command including the recorded dev number.

- [ ] **Step 6: Inspect packaged manifest**

Run:

```bash
XPI_PATH="$(ls -1 .scaffold/build/Deepseek.Copliot-0.9.8-dev.*.xpi | tail -1)"
unzip -p "$XPI_PATH" manifest.json \
  | jq -r '
      if (.version | startswith("0.9.8."))
        and (.version_name | startswith("0.9.8-dev."))
        and .applications.zotero.id == "zotero-ai-assistant@agentpaper.dev"
        and .applications.zotero.strict_min_version == "7.0"
        and .applications.zotero.strict_max_version == "10.*"
      then "manifest ok"
      else error("manifest mismatch: " + (. | tostring))
      end
    '
```

Expected:

```text
manifest ok
```

Then paste `manifest ok` and the XPI path into the smoke log notes.

- [ ] **Step 7: Capture hashes**

Run:

```bash
XPI_PATH="$(ls -1 .scaffold/build/Deepseek.Copliot-0.9.8-dev.*.xpi | tail -1)"
shasum -a 256 "$XPI_PATH" .scaffold/build/update.json
```

Expected: two SHA-256 lines.

Then paste both hashes into the smoke log.

- [ ] **Step 8: Commit automated gate evidence**

Run:

```bash
git add docs/community/v0.9.8-smoke-log.md
git commit -m "docs: record v0.9.8 dev build gates"
```

Expected: commit succeeds and includes only the smoke log.

### Task 4: Discover Local Zotero Targets

**Files:**

- Modify: `docs/community/v0.9.8-smoke-log.md`

- [ ] **Step 1: List Zotero apps in `/Applications`**

Run:

```bash
find /Applications -maxdepth 2 \( -iname 'Zotero*.app' -o -iname '*Zotero*.app' \) -print
```

Expected: one or more Zotero app bundles, or no output.

- [ ] **Step 2: List project-local Zotero apps**

Run:

```bash
find /Users/Liang -maxdepth 5 \( -iname 'Zotero*.app' -o -iname '*Zotero*.app' \) -print 2>/dev/null
```

Expected: one or more Zotero app bundles, or no output.

- [ ] **Step 3: Record discovered targets**

For each discovered app, run:

```bash
APP="/Applications/Zotero.app"
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist"
```

Expected: version and build strings.

Update `docs/community/v0.9.8-smoke-log.md` so every available target row contains the app path and exact version/build. If Zotero 10 beta is missing, record `blocked: app not installed` and do not proceed to formal release. Zotero 7, 8, and 9 are recorded for context but user-waived for real smoke in this run.

- [ ] **Step 4: Commit environment discovery**

Run:

```bash
git add docs/community/v0.9.8-smoke-log.md
git commit -m "docs: record v0.9.8 zotero smoke targets"
```

Expected: commit succeeds and includes only the smoke log.

### Task 5: Run Scoped Packaged Smoke On Zotero 10 Beta

**Files:**

- Modify: `docs/community/v0.9.8-smoke-log.md`

- [ ] **Step 1: Prepare the common XPI path**

Run:

```bash
XPI_PATH="$(ls -1 .scaffold/build/Deepseek.Copliot-0.9.8-dev.*.xpi | tail -1)"
test -f "$XPI_PATH"
echo "$XPI_PATH"
```

Expected: the dev XPI path prints and `test` exits `0`.

- [ ] **Step 2: Record Zotero 7/8/9 scope waiver**

Update the smoke log matrix so Zotero 7, 8, and 9 are marked `user-waived` rather than `pending` or `pass`.

Record:

```markdown
Zotero 7/8/9 scope:

- Fresh real smoke: user-waived on 2026-07-01
- Rationale: user states these plugin paths are already OK
- Public fallback: v0.9.7 remains available
```

Expected: 7/8/9 pending rows no longer block the scoped dev-smoke decision, and the log does not falsely claim fresh pass evidence.

- [ ] **Step 3: For Zotero 10 beta, import through Add-ons manager**

Use the Zotero 10 beta app recorded in the smoke log. Import `$XPI_PATH` through Zotero's native Add-ons manager using `Install Plugin From File...` or `Install Add-on From File...`.

Record:

```markdown
Zotero 10 beta install chain:

- app:
- exact version/build:
- XPI:
- Add-ons entry:
- installed version/hash:
- result:
```

Expected: Add-ons entry shows `Deepseek Copliot` and the installed version/hash corresponds to the dev XPI.

- [ ] **Step 4: For Zotero 10 beta, run host and restart checks**

In Zotero 10 beta, record:

```markdown
Zotero 10 beta host checks:

- Settings pane:
- Library right pane:
- Reader right pane:
- Reader selection popup actions:
- right-click Reader actions:
- cold restart repeat:
- top-toolbar-only D artifact:
- result:
```

Expected: Settings and native right-pane surfaces appear, Reader actions exist, restart repeats the critical path, and no toolbar-only `D...` artifact is accepted as a pass. Label this evidence as beta compatibility verification.

- [ ] **Step 5: Commit packaged smoke evidence**

Run:

```bash
git add docs/community/v0.9.8-smoke-log.md
git commit -m "docs: record v0.9.8 packaged smoke evidence"
```

Expected: commit succeeds and includes only the smoke log.

### Task 6: Decide Whether Formal Release Can Start

**Files:**

- Modify: `docs/community/v0.9.8-smoke-log.md`

- [ ] **Step 1: Inspect the smoke matrix**

Run:

```bash
rg -n "pending|failed|blocked" docs/community/v0.9.8-smoke-log.md
```

Expected before formal release:

```text

```

No `pending`, `failed`, or `blocked` entries may remain in required Zotero 10 beta gates. Zotero 7/8/9 rows may remain `user-waived`.

- [ ] **Step 2: Record release decision**

If all gates pass, update the release decision section:

```markdown
## Release Decision

- Dev XPI smoke result: pass
- Zotero 7/8/9 regression risk: fresh smoke user-waived; v0.9.7 remains fallback
- Zotero 10 beta compatibility: pass on recorded beta build
- Formal release status: ready for a separate v0.9.8 release plan
```

If any required gate fails or is blocked, update it instead:

```markdown
## Release Decision

- Dev XPI smoke result: blocked
- Formal release status: do not tag v0.9.8
- Public fallback: keep v0.9.7 as latest release
- Blocking item:
```

- [ ] **Step 3: Commit the release decision**

Run:

```bash
git add docs/community/v0.9.8-smoke-log.md
git commit -m "docs: decide v0.9.8 release readiness"
```

Expected: commit succeeds and includes only the smoke log.

### Task 7: Stop Before Formal Tagging

**Files:**

- Read: `docs/community/v0.9.8-smoke-log.md`

- [ ] **Step 1: Confirm no v0.9.8 release was created during dev smoke**

Run:

```bash
gh release view v0.9.8 --json tagName,url
```

Expected:

```text
release not found
```

- [ ] **Step 2: Confirm no local v0.9.8 tag exists**

Run:

```bash
git tag --list v0.9.8
```

Expected: no output.

- [ ] **Step 3: Report status**

Report:

```text
v0.9.8 dev smoke status:
- branch:
- dev XPI:
- automated gates:
- Zotero 7/8/9:
- Zotero 10 beta:
- formal release:
- next step:
```

Expected: formal release is either `not ready` with blockers or `ready for separate release plan`; no tag is pushed in this plan.
