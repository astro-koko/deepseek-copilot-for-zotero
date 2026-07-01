# Deepseek Copliot v0.9.8 Dev Smoke Release Design

Status: Updated after user scope change
Owner: Codex
Related issue: v0.9.8 Zotero 7-10 compatibility release
Target release: v0.9.8, gated by dev XPI smoke first

## Problem

Deepseek Copliot v0.9.7 is the latest public release and is usable by current users. The remote `origin/main` branch now prepares v0.9.8 with `package.json` version `0.9.8` and Zotero compatibility set to `strict_min_version: "7.0"` and `strict_max_version: "10.*"`.

The risk is that a fast v0.9.8 release could widen marketplace compatibility while regressing the default Zotero 7, 8, and 9 user path that v0.9.7 currently protects. Zotero 10 is also a beta-line compatibility target, not the daily stable target.

On 2026-07-01, the user narrowed the execution scope: Zotero 7, 8, and 9 do not need to be re-smoked in this dev-smoke round because those plugin paths are already considered working. The remaining hard packaged-smoke gate for this round is Zotero 10 beta. Zotero 7-9 remain protected by the public v0.9.7 fallback and by not publishing v0.9.8 until the user accepts the scoped release evidence.

## Goals

- Keep v0.9.7 as the public fallback until v0.9.8 has real packaged evidence.
- Build and install a v0.9.8 dev XPI before any formal tag or GitHub release.
- Treat Zotero 7, 8, and 9 real smoke as user-waived for this round, while preserving v0.9.7 as the public fallback.
- Prove Zotero 10 beta can install and run the packaged XPI before publishing a `10.*` compatibility claim.
- Publish v0.9.8 only after the automated gates pass and the Zotero 10 beta packaged install, host-surface, Reader, and restart gates pass, or after a separate user-approved release plan further adjusts the gate.

## Non-goals

- Do not merge the dirty local main worktree into v0.9.8.
- Do not change product behavior unless smoke uncovers a release-blocking regression.
- Do not use `npm start`, proxy mode, hand-copied extension files, or edited Zotero registries as release evidence.
- Do not create a formal `v0.9.8` tag or GitHub release before dev smoke passes.
- Do not promise final Zotero 10 stable support unless the final Zotero 10 stable line has been tested.

## User Workflow

Current users stay on the working v0.9.7 GitHub release while v0.9.8 is validated. The release candidate is built as a dev XPI, installed manually through Zotero's native Add-ons manager, and tested in real Zotero profiles.

For the current scoped run, Zotero 7, 8, and 9 are recorded as user-waived rather than release blockers. If Zotero 10 beta passes, the same branch can move to a separate formal release plan. If Zotero 10 beta fails, v0.9.8 is not published and the public latest release remains v0.9.7.

## Scope And Boundaries

Work runs in the isolated worktree:

```text
/Users/Liang/project/agentpaper_zotero-worktrees/v0.9.8-dev-smoke
```

The source branch is `release/v0.9.8-dev-smoke`, created from `origin/main` at `0dd125586216c25b40a036ced21881ef17f679c7`.

The original worktree at `/Users/Liang/project/agentpaper_zotero` has unrelated local changes and must not be mutated by this release effort.

## Design Decisions

### Dev XPI before release XPI

Run:

```bash
npm ci
npm test
npm run build:dev:xpi
npm run verify:xpi
```

The dev package should carry a dev build label while keeping `package.json` at `0.9.8`. This proves the install path without making the public release feed pick up the package.

### Compatibility claim stays conditional

The current branch advertises Zotero `7.0` through `10.*`. In this scoped run, the user explicitly waived fresh Zotero 7, 8, and 9 smoke. The `10.*` part of the claim remains conditional on a packaged smoke pass on the current Zotero 10 beta.

The release notes must say that Zotero 10 coverage is beta-build verification as of the smoke date, unless Zotero 10 stable has been released and tested by then.

### v0.9.7 remains the rollback line

Do not delete, retag, or overwrite v0.9.7. If v0.9.8 smoke fails, stop release work and leave v0.9.7 as the latest public release.

### Install-chain proof comes first

Every real Zotero pass must advance in this order:

1. XPI path and hash recorded
2. packaged manifest inspected
3. XPI imported through Zotero Add-ons manager
4. Add-ons entry visible
5. Settings pane visible
6. Library right-pane surface visible
7. Reader right-pane surface visible
8. Reader actions visible and connected
9. cold restart repeats the critical path

## Files Expected To Change

This spec-only phase changes:

- `docs/superpowers/specs/2026-07-01-deepseek-copliot-v0-9-8-dev-smoke-design.md`

Implementation and release execution may touch only if needed:

- `docs/superpowers/plans/2026-07-01-deepseek-copliot-v0-9-8-dev-smoke-plan.md`
- `CHANGELOG.md`
- `README.md`
- `docs/community/zotero-7-10-marketplace-v0.9.8.md`
- `docs/community/v0.9.8-smoke-log.md`

Code, manifest, build scripts, or package files should not change unless a release-blocking issue is discovered and a focused plan approves the fix.

## Acceptance Criteria

v0.9.8 may be released only when all criteria are met:

- `npm ci` succeeds in the clean worktree.
- `npm test` succeeds.
- `npm run build:dev:xpi` succeeds.
- `npm run verify:xpi` succeeds on the dev XPI.
- The packaged XPI manifest has version metadata for `0.9.8` or `0.9.8-dev.<number>` as expected by the build script.
- The packaged XPI manifest contains `strict_min_version: "7.0"` and `strict_max_version: "10.*"`.
- Zotero 7, 8, and 9 smoke are marked user-waived for this round, not passed by new evidence.
- Zotero 10 beta packaged install and restart smoke passes, with the exact beta build recorded.
- Add-ons, Settings, Library right pane, Reader right pane, Reader selection actions, and restart repeat are recorded for Zotero 10 beta.
- No top-toolbar-only `D...` discovery artifact is accepted as a pass.
- Public release profile checks show no prefilled private API keys and no restored test threads.

## Verification Plan

### Build preflight

```bash
npm ci
npm test
npm run build:dev:xpi
npm run verify:xpi
unzip -p .scaffold/build/*.xpi manifest.json | jq '.version, .version_name, .applications.zotero'
shasum -a 256 .scaffold/build/*.xpi .scaffold/build/update.json
```

### Zotero matrix

Preferred target versions:

| Target                 | Role                                  | Minimum smoke                                                        |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Zotero 7.0.32          | compatibility floor                   | user-waived for this run                                             |
| Zotero 8.0.5           | compatibility bridge                  | user-waived for this run                                             |
| Zotero 9.0.4           | current stable target on this machine | user-waived for this run                                             |
| current Zotero 10 beta | compatibility target                  | install, Add-ons, Settings, Library, Reader, Reader actions, restart |

If local machine setup cannot run Zotero 10 beta, record the blocker in `docs/community/v0.9.8-smoke-log.md` and do not release until Zotero 10 beta is tested somewhere else or the user explicitly changes the gate again.

### Release conversion

Only after dev smoke passes:

```bash
npm run build:release:xpi
npm run verify:xpi
unzip -p .scaffold/build/Deepseek.Copliot-0.9.8.xpi manifest.json | jq '.version, .version_name, .applications.zotero'
shasum -a 256 .scaffold/build/Deepseek.Copliot-0.9.8.xpi .scaffold/build/update.json
git tag v0.9.8
git push origin v0.9.8
```

The GitHub Actions release output becomes the public source of truth. After the release is public, run:

```bash
npm run marketplace:check -- --target 7
npm run marketplace:check -- --target 8
npm run marketplace:check -- --target 9
npm run marketplace:check -- --target 10
```

Feed refresh lag is tracked after release. It does not replace packaged smoke evidence.

## Rollout Or Release Notes

Release notes should say:

- v0.9.8 is the unified Zotero 7-10 marketplace compatibility release.
- Zotero 7, 8, and 9 were not re-smoked in this run by user direction; v0.9.7 remains the prior stable fallback.
- Zotero 10 support is based on the recorded beta build tested on the release date.
- v0.9.7 remains the prior stable fallback.

## Risks And Mitigations

- Risk: Zotero 7-9 users lose a working plugin after v0.9.8.
  Mitigation: user waived fresh 7-9 smoke for this run; keep v0.9.7 as fallback, avoid unrelated code changes, and make the release notes honest about the scoped evidence.

- Risk: Zotero 10 beta behavior changes before stable.
  Mitigation: label Zotero 10 evidence as beta-build verification and retest when the stable line changes.

- Risk: local dirty main changes accidentally enter release.
  Mitigation: use only the clean worktree from `origin/main`; do not merge the original local worktree.

- Risk: marketplace feed lags behind GitHub release.
  Mitigation: use `marketplace:check` after release and treat lag as a follow-up tracking item.

- Risk: GUI automation produces false confidence.
  Mitigation: follow the real-smoke guardrails: one control plane per micro-task, frontmost app checks before mutating actions, and the two-strike stop rule.

## Environment Discovery

Before smoke execution, discover and record which installed Zotero binaries or app bundles are available for Zotero 7, 8, 9, and 10 beta on this machine. For the current scoped run, only Zotero 10 beta remains a required real-smoke target.

Release evidence must be recorded in `docs/community/v0.9.8-smoke-log.md`.

If Zotero 10 beta packaged smoke fails, delay v0.9.8 entirely. Do not publish a `10.*` compatibility release from this branch without Zotero 10 beta evidence or another explicit user-approved gate change.
