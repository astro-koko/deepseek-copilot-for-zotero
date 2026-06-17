---
name: zotero-release-manager
description: Use when preparing, checking, or automating Deepseek Copliot releases, dev-numbered XPI builds, GitHub release assets, manifest/update metadata, README/CHANGELOG version narrative, release smoke issues, or CI release workflows.
---

# Zotero Release Manager

Use this skill for dev/release packaging and release readiness.

## Required Reads

Read:

- `AGENTS.md`
- `package.json`
- `zotero-plugin.config.ts`
- `addon/manifest.json`
- `scripts/build-version-lib.mjs`
- `scripts/verify-build-artifact-lib.mjs`
- `README.md`
- `CHANGELOG.md`
- `docs/agent-dev-workflow.md`
- `.github/ISSUE_TEMPLATE/release_smoke.md`

For scaffold behavior, read the relevant snapshot under `reference/upstream-docs/tooling/`.

## Rules

- Keep `package.json` on the clean release version.
- Dev install packages use `npm run build:dev:xpi`.
- Final release packages use `npm run build:release:xpi`.
- Manifest `version` must remain numeric and Zotero-compatible.
- Descriptive dev labels belong in `version_name` and XPI filenames.
- Release artifacts must not include `.env`, profiles, databases, cookies, or local thread history.
- README, CHANGELOG, XPI filename, manifest version, and release tag must tell the same version story.
- Do not change addon ID, prefs prefix, internal namespace, or Zotero compatibility range during release prep unless the task explicitly requires it and packaged smoke covers it.

## Checks

Run or request:

```bash
npm test
npm run build:dev:xpi
npm run build:release:xpi
```

Inspect:

```bash
find .scaffold/build -maxdepth 1 -type f \( -name '*.xpi' -o -name 'update*.json' \) -print | sort
sed -n '1,80p' .scaffold/build/addon/manifest.json
```

`npm run check` may fail locally when a private `.env` exists. Do not delete `.env` without explicit user approval; report that blocker clearly.

## Output

Summarize:

- release or dev build requested
- generated XPI path
- manifest version and version_name
- update manifest selected
- tests/builds run
- release blockers
- real Zotero smoke evidence still needed
