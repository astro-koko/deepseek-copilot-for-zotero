# Deepseek Copliot Slash Settings Rewrite Design

Status: Approved for implementation
Owner: AgentPaper
Related issue: Slash command settings rewrite, settings-layer slash regression
Target release: next settings-stability release

## Classification

Classification: `feature`

This is a user-facing feature rewrite that also resolves an active Settings-layer
bug where slash controls do not hydrate or respond in real Zotero.

Affected Zotero surfaces:

- Settings pane
- Slash command catalog
- Sidebar home recommendations
- Local settings persistence

## Problem

The current `Commands and Prompts` area is not acceptable as a product surface.

- In real Zotero, the visible slash controls can fail to hydrate and the
  `Add custom command` button can become non-responsive.
- The current UI is still shaped around developer storage concepts such as raw
  JSON, internal ids, aliases, evidence flags, and sidebar pinning.
- The current default slash behavior is English-first, while the active user
  workflow here is Chinese-first.
- The current editing model mixes built-in commands and user overrides in a way
  that is fragile to restore, copy, and add flows.

The rewrite should stop treating slash configuration as a JSON management task.
The normal user path should be a compact card editor for `title`, `slash`, and
`prompt text`, with automatic save when the user leaves an editor.

## Goals

- Replace the current slash settings area with a Chinese-first, card-based
  editor.
- Remove JSON from the Settings UI entirely.
- Split internal stable command identity from the user-visible slash token.
- Let users edit built-in command `title`, `slash`, and `prompt text` directly.
- Let users create and delete custom commands directly in Settings.
- Auto-save when the user leaves an editor, while preventing invalid saves.
- Limit custom commands to 10 entries.
- Keep the sidebar home surface simple by reserving it for a small fixed set of
  built-in commands.
- Preserve old custom command data where possible through migration helpers.

## Non-goals

- Do not add a JSON import or export flow in this rewrite.
- Do not add a prompt marketplace or sync model.
- Do not expose aliases, evidence flags, internal groups, or scope controls in
  the main Settings UI.
- Do not redesign Reader handoff, provider requests, or host surfaces outside
  Settings.
- Do not copy Beaver's React preferences window or action target taxonomy.
- Do not change Deepseek Copliot branding or the accepted right-pane ownership.

## User Workflow

### Built-in Commands

1. User opens Zotero Settings.
2. User opens the `Deepseek Copliot` pane.
3. User scrolls to `命令与提示词`.
4. User sees a dedicated sub-title `Slash 命令`.
5. User sees a `默认命令` section with built-in cards.
6. User clicks a card.
7. The card opens inline editors for `标题`, `简写`, and `提示词`.
8. User edits the fields.
9. User clicks elsewhere or tabs away.
10. If the fields are valid, the card auto-saves.
11. If the fields are invalid, the card stays open and shows inline error text.
12. User can restore a built-in command back to the code-defined default.

### Custom Commands

1. User opens the `我的命令` section.
2. User clicks `新增命令`.
3. A new blank editable card appears.
4. User fills `标题`, `简写`, and `提示词`.
5. Leaving the editor auto-saves the new command if valid.
6. If the new command is still empty when the user leaves the editor, it is
   discarded.
7. User can delete a saved custom command.
8. If the user already has 10 custom commands, `新增命令` becomes disabled and
   shows a short limit hint.

## Scope And Boundaries

### In Scope

- Slash settings structure, copy, and interaction model in the Zotero Settings
  pane.
- Built-in slash defaults, including Chinese-first visible slash tokens.
- A migration path from old stored custom presets to the rewritten UI model.
- Tests for rendering, validation, persistence, and slash resolution.

### Out Of Scope

- Any new network provider behavior.
- Any public release packaging policy changes.
- Any Zotero 10 compatibility broadening.
- Any separate settings window or React-hosted settings app.

## Design Decisions

### 1. Keep Structured Storage Internal, But Remove JSON UI

The plugin may continue storing structured command data internally, but the
Settings pane must no longer expose JSON as a user-facing workflow. The user
does not need to understand internal persistence shape to manage slash commands.

### 2. Split Stable Internal Id From Visible Slash Token

Each command keeps a stable internal `id` for migration, matching, and built-in
override logic.

Each command also gets a user-visible `slashCommand` field that controls what
appears in the slash menu and what the user edits in Settings.

This solves the current coupling where English internal ids also become the
default slash tokens.

### 3. Chinese-First Defaults For The Active Locale

Built-in commands should default to Chinese title and Chinese slash token in the
Chinese locale.

Example defaults:

- `/总结`
- `/解释`
- `/贡献`
- `/方法`
- `/局限`
- `/查证`
- `/背景`
- `/相关`

The visible command title should also default to Chinese in the Chinese locale.

### 4. Minimal User-Facing Fields

The main card editor should expose only:

- `标题`
- `简写`
- `提示词`

The following remain internal:

- stable id
- aliases
- evidence hint
- group
- scope hint
- sidebar pin state

This keeps the Settings surface legible and avoids a developer-console feel.

### 5. Sidebar Home Recommendations Stay Fixed

The sidebar home panel should continue using a small fixed set of built-in
commands. This rewrite should not let custom commands or arbitrary user toggles
reshape that surface. Users may edit the visible label and prompt of those
built-ins, but the home-panel membership stays code-defined.

### 6. Auto-save On Blur With Guardrails

Leaving an editor should attempt save automatically.

Validation rules:

- `标题` is required
- `简写` is required
- `提示词` is required
- `简写` must be unique across built-in and custom commands
- `简写` must normalize cleanly into one slash token

If validation fails:

- the card stays in edit mode
- the invalid field is not silently dropped
- inline error text appears inside the card

### 7. Custom Command Limit

The system should allow at most 10 custom commands.

This limit applies only to user-created commands, not built-ins. It keeps the
Settings UI compact and prevents the slash menu from turning into an unmanaged
long list.

### 8. Built-in Restore Instead Of Hide/Copy Workflows

The current copy/hide/reset behavior is too fragile for the simplified UI.

For this rewrite:

- built-ins are always visible in the `默认命令` section
- built-ins can be edited inline
- built-ins can be restored to default
- built-ins are not hidden from the main UI

This makes the behavior easier to explain and verify.

### 9. Migration Strategy

Old stored command data should not be thrown away.

Migration rules:

- keep existing internal ids when present
- if an old record lacks `slashCommand`, derive it from the old visible token or
  fall back to the previous id-based token
- built-in overrides continue matching by stable internal id
- custom commands are normalized into the new `title` + `slashCommand` +
  `promptPrefix` shape

### 10. Settings Initialization Must Be Explicitly Re-proven

This rewrite must also address the live Settings-layer regression where the
command editor fails to hydrate. The final implementation must re-prove the
preference pane initialization path in real Zotero, not just in source tests.

## Files Expected To Change

- `addon/content/preferences.xhtml`
- `addon/locale/en-US/preferences.ftl`
- `addon/locale/zh-CN/preferences.ftl`
- `src/modules/preferencesPane.ts`
- `src/modules/preferencesPane.test.ts`
- `src/modules/preferencesPaneSource.test.ts`
- `src/modules/preferencesLocaleSource.test.ts`
- `src/services/settingsManager.ts`
- `src/services/settingsManager.test.ts`
- `src/services/presets.ts`
- `src/services/presets.test.ts`
- `docs/zotero-dev-smoke-checklist.md`

## Acceptance Criteria

- The Settings pane shows a dedicated `Slash 命令` sub-title under
  `命令与提示词`.
- The Settings pane does not show JSON import, preview, raw JSON storage, or
  related JSON actions.
- Built-in commands render as visible editable cards in real Zotero.
- Clicking a built-in card opens editors for `标题`, `简写`, and `提示词`.
- Leaving an edited built-in card saves valid changes automatically.
- Built-in cards expose `恢复默认`.
- Custom commands can be added and deleted from `我的命令`.
- Empty unsaved custom cards are discarded on blur.
- The custom command count is capped at 10.
- Chinese locale defaults show Chinese command titles and Chinese visible slash
  tokens.
- Slash resolution uses the visible `slashCommand`, not only the internal id.
- Existing stored command data migrates without losing user-authored prompts.
- The real Zotero Settings `Add` flow works on the installed dev XPI.

## Verification Plan

Automated verification:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts src/services/presets.test.ts
npm test
```

Build verification:

```bash
npm run build:dev:xpi
npm run verify:xpi
```

## Real Zotero Smoke

Packaged `.xpi` smoke is required.

Required evidence:

- Installed XPI version and hash
- Settings pane opens in the active dev package
- `默认命令` cards render
- `我的命令` add flow works
- blur auto-save works for `标题`, `简写`, and `提示词`
- invalid duplicate slash token blocks exit and shows inline error
- restore built-in works
- custom command limit is enforced
- close and reopen Settings preserves edits
- cold restart preserves edits

## Reference Adoption

Reference source and files inspected:

- `reference/beaver-zotero/react/components/preferences/ActionsPreferenceSection.tsx`
- `reference/beaver-zotero/react/components/preferences/ActionCard.tsx`

Pattern borrowed:

- Card-based command editing
- Inline open/edit flow
- Click-away save behavior for compact prompt editing
- Separate built-in vs user-created command sections

Pattern explicitly not borrowed:

- React preferences window
- Beaver action target types
- Beaver sync/account architecture
- Full action taxonomy and onboarding copy

Local modules affected:

- `src/modules/preferencesPane.ts`
- `src/services/settingsManager.ts`
- `src/services/presets.ts`

Privacy and persistence impact:

- Changes stay local to Zotero preferences
- No new API key surface
- No new remote sync or telemetry

Automated tests to add or update:

- Settings rendering and interaction tests
- Slash token resolution tests
- Migration normalization tests

Real Zotero evidence needed:

- Settings pane hydration and interaction proof on packaged dev XPI

## Risks And Mitigations

- Risk: rewriting the command editor could break old stored overrides
  Mitigation: add migration-focused tests before changing persistence behavior

- Risk: the real Zotero hydration bug could be masked by fake DOM tests
  Mitigation: keep a real packaged smoke gate in the verification plan

- Risk: Chinese visible slash tokens could collide after normalization
  Mitigation: enforce uniqueness in the editor and add collision tests

- Risk: removing user-visible sidebar pin controls reduces flexibility
  Mitigation: keep home recommendations stable for this release and treat any
  wider configurability as a separate follow-up issue

## Open Questions

- Should English locale keep English visible slash defaults, or should all
  locales move to the same Chinese-first set? Current implementation will keep
  locale-sensitive defaults and prioritize Chinese in the Chinese locale.
