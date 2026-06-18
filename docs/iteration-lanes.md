# Iteration Lanes

Use lanes to keep agent work, review, and release evidence clean. A lane is a review boundary, not a permanent architecture boundary.

## Why This Exists

Zotero plugin work often mixes build metadata, native host surfaces, settings UI, Reader handoff, provider calls, and real GUI smoke. Mixed changes are hard to review and make release failures ambiguous.

Prefer small lane-specific issues and commits.

## Lanes

### release-build

Scope:

- `package.json`
- `package-lock.json`
- `zotero-plugin.config.ts`
- `addon/manifest.json`
- `scripts/**`
- `.github/**`
- release-related README/CHANGELOG/docs changes

Verification:

```bash
npm run check
npm run build:dev:xpi
npm run build:release:xpi
```

Evidence:

- XPI path
- manifest `version` and `version_name`
- selected update manifest
- packaged archive verification

### agent-workflow

Scope:

- `AGENTS.md`
- `docs/agent-dev-workflow.md`
- `docs/reference-adoption.md`
- issue/PR templates

Verification:

```bash
npm test
```

Evidence:

- skill names and trigger descriptions
- affected workflow docs
- next issues generated from the workflow

### settings

Scope:

- `addon/content/preferences.xhtml`
- `addon/locale/**/preferences.ftl`
- `src/modules/preferencesPane*`
- `src/services/settingsManager*`
- `typings/i10n.d.ts`

Verification:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts
npm test
```

Real Zotero smoke when user-visible settings change:

- Settings pane opens
- edit/save/reopen works
- restart persistence works
- public release profile has no prefilled keys

### composer

Scope:

- `src/ui/components/Composer.tsx`
- `src/ui/components/Composer.test.tsx`
- composer-related view model or sidebar tests

Verification:

```bash
npm test -- src/ui/components/Composer.test.tsx src/ui/components/sidebarViewModel.test.ts
npm test
```

Real Zotero smoke when host behavior changes:

- Reader composer accepts input
- Send enable/disable state is correct
- manual send creates visible thread or actionable error

### reader-host

Scope:

- `src/modules/readerIntegration.ts`
- `src/ui/readerActionFlow.ts`
- `src/ui/ui.ts`
- Reader host tests

Verification:

```bash
npm test -- src/ui/readerActionFlow.test.ts src/ui/ui.test.ts
npm run build:dev:xpi
```

Real Zotero smoke:

- Reader right-pane entry appears
- active PDF tab determines scope
- `Explain` auto-send works
- `Ask...` prefill-only works
- no top-toolbar-only `D...` artifact

### provider-context

Scope:

- `src/services/provider/**`
- `src/services/contextAssembler*`
- `src/services/chatEngine*`
- `src/services/hostSmoke*`

Verification:

```bash
npm test -- src/services/provider/openAICompatibleProvider.test.ts src/services/contextAssembler.test.ts src/services/chatEngine.test.ts src/services/hostSmoke.test.ts
npm test
```

Real Zotero smoke:

- provider round-trip only after install and host surfaces pass
- local `.env` keys may be used by the agent for GUI/provider smoke
- product release path still requires users to enter keys in Zotero Settings

## Current Workspace Split

The current workspace contains at least two active lanes:

- `release-build` / `agent-workflow`: dev/release XPI versioning, privacy check, GitHub templates, project skills, AGENTS instructions, reference adoption docs
- `settings` / `composer`: pre-existing preferences and Composer UI changes

Review and commit them separately unless a later user request explicitly asks for one combined change.

## Agent Rule

When a new issue starts, state its lane before editing files. If a task needs more than one lane, split it into ordered issues unless the cross-lane change is necessary for a single acceptance gate.
