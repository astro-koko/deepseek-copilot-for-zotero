# Deepseek Copliot Slash Settings Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current slash-settings surface with a Chinese-first card editor that removes JSON from the Settings UI and fixes the live Settings-layer slash regression.

**Architecture:** Keep structured command persistence internal, but introduce a visible `slashCommand` field separate from the stable internal `id`. Rewrite the Settings command editor around two card sections, `默认命令` and `我的命令`, with blur-triggered auto-save, inline validation, built-in restore, and a 10-command custom cap. Preserve old data through normalization and migration helpers rather than by keeping the old JSON workflow alive.

**Tech Stack:** Zotero preferences XHTML, TypeScript DOM rendering and event binding, internal preset/settings helpers, Vitest, packaged dev XPI smoke.

---

## File Structure

- `docs/superpowers/specs/2026-06-17-ds-copilot-slash-settings-rewrite-design.md`: approved design for this rewrite.
- `addon/content/preferences.xhtml`: simplified Settings markup without any JSON command controls.
- `addon/locale/en-US/preferences.ftl`: English strings for slash card sections and validation.
- `addon/locale/zh-CN/preferences.ftl`: Chinese strings for slash card sections and validation.
- `src/services/settingsManager.ts`: normalization, migration, and validation helpers for the rewritten command shape.
- `src/services/settingsManager.test.ts`: persistence and migration tests.
- `src/services/presets.ts`: built-in command defaults, locale-visible slash tokens, and slash resolution logic.
- `src/services/presets.test.ts`: slash resolution and built-in catalog tests.
- `src/modules/preferencesPane.ts`: command card rendering, card editing, blur-save logic, validation, and Settings hydration fix.
- `src/modules/preferencesPane.test.ts`: DOM/event tests for card editing and auto-save behavior.
- `src/modules/preferencesPaneSource.test.ts`: source tests proving JSON controls are removed and the new section exists.
- `src/modules/preferencesLocaleSource.test.ts`: locale-string coverage for the new copy.
- `docs/zotero-dev-smoke-checklist.md`: updated Settings smoke notes for the rewritten slash workflow.

## Task 1: Rewrite The Settings Source Skeleton

**Files:**
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Test: `src/modules/preferencesPaneSource.test.ts`
- Test: `src/modules/preferencesLocaleSource.test.ts`

- [ ] **Step 1: Write the failing source tests**

Add tests to `src/modules/preferencesPaneSource.test.ts` that assert:

```ts
it("renders a dedicated slash section without JSON command controls", () => {
  expect(preferencesSource).toContain(
    'data-l10n-id="ai-assistant-pref-slash-title"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-slash-builtins"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-slash-custom"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-slash-add"',
  );
  expect(preferencesSource).not.toContain(
    'id="zotero-ai-assistant-pref-custom-presets-import"',
  );
  expect(preferencesSource).not.toContain(
    'id="zotero-ai-assistant-pref-custom-presets-copy-ai-prompt"',
  );
  expect(preferencesSource).not.toContain(
    'id="zotero-ai-assistant-pref-custom-presets-docs-link"',
  );
});
```

- [ ] **Step 2: Write the failing locale tests**

Add tests to `src/modules/preferencesLocaleSource.test.ts` that assert:

```ts
expect(zhPreferences).toContain(
  "ai-assistant-pref-slash-title = Slash 命令",
);
expect(zhPreferences).toContain(
  "ai-assistant-pref-slash-builtins-title = 默认命令",
);
expect(zhPreferences).toContain(
  "ai-assistant-pref-slash-custom-title = 我的命令",
);
expect(zhPreferences).toContain(
  "ai-assistant-pref-slash-add = 新增命令",
);
expect(zhPreferences).toContain(
  "ai-assistant-pref-slash-limit = 最多只能添加 10 个自定义命令",
);
```

- [ ] **Step 3: Run the source tests to verify failure**

Run:

```bash
npm test -- src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts
```

Expected: FAIL because the new slash section ids and strings do not exist yet.

- [ ] **Step 4: Replace the old command markup with the new shell**

In `addon/content/preferences.xhtml`, remove the current JSON-oriented command controls and replace them with:

```xml
<description
  data-l10n-id="ai-assistant-pref-commands-title"
  style="font-weight: 600"
/>
<description data-l10n-id="ai-assistant-pref-commands-help" />
<description
  data-l10n-id="ai-assistant-pref-slash-title"
  style="font-weight: 600; margin-top: 8px"
/>
<description data-l10n-id="ai-assistant-pref-slash-help" />
<html:div
  id="zotero-ai-assistant-pref-slash-builtins"
  style="display: flex; flex-direction: column; gap: 10px; width: 100%;"
></html:div>
<html:div
  id="zotero-ai-assistant-pref-slash-custom"
  style="display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 10px;"
></html:div>
<html:div
  style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px;"
>
  <button
    id="zotero-ai-assistant-pref-slash-add"
    label="Add custom command"
    data-l10n-id="ai-assistant-pref-slash-add"
  />
  <description id="zotero-ai-assistant-pref-slash-limit-status" />
</html:div>
<html:textarea
  id="zotero-ai-assistant-pref-custom-presets"
  spellcheck="false"
  style="display: none;"
  readonly="readonly"
></html:textarea>
```

- [ ] **Step 5: Add the new locale strings**

Add English strings:

```text
ai-assistant-pref-slash-title = Slash Commands
ai-assistant-pref-slash-help = Edit built-in commands or create your own commands by changing only the title, slash token, and prompt text.
ai-assistant-pref-slash-builtins-title = Built-in commands
ai-assistant-pref-slash-custom-title = My commands
ai-assistant-pref-slash-add = Add command
ai-assistant-pref-slash-limit = You can add up to 10 custom commands
ai-assistant-pref-slash-empty = No custom commands yet
```

Add Chinese strings:

```text
ai-assistant-pref-slash-title = Slash 命令
ai-assistant-pref-slash-help = 直接编辑默认命令，或新增自己的命令。这里只需要改标题、简写和提示词。
ai-assistant-pref-slash-builtins-title = 默认命令
ai-assistant-pref-slash-custom-title = 我的命令
ai-assistant-pref-slash-add = 新增命令
ai-assistant-pref-slash-limit = 最多只能添加 10 个自定义命令
ai-assistant-pref-slash-empty = 还没有自定义命令
```

- [ ] **Step 6: Re-run the source tests**

Run:

```bash
npm test -- src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts
```

Expected: PASS.

## Task 2: Add The Rewritten Command Data Model

**Files:**
- Modify: `src/services/settingsManager.ts`
- Modify: `src/services/presets.ts`
- Test: `src/services/settingsManager.test.ts`
- Test: `src/services/presets.test.ts`

- [ ] **Step 1: Write the failing persistence tests**

Add tests to `src/services/settingsManager.test.ts` covering:

```ts
it("normalizes a visible slash command separate from the stable id", () => {
  const parsed = parseCustomPresets(
    JSON.stringify([
      {
        id: "future-work",
        slashCommand: "未来工作",
        label: "未来工作",
        promptPrefix: "请总结后续值得推进的问题",
      },
    ]),
  );

  expect(parsed.error).toBeNull();
  expect(parsed.presets[0]?.id).toBe("future-work");
  expect(parsed.presets[0]?.slashCommand).toBe("未来工作");
});

it("migrates legacy records that do not have slashCommand", () => {
  const parsed = parseCustomPresets(
    JSON.stringify([
      {
        id: "legacy-summary",
        label: "旧总结",
        promptPrefix: "旧提示词",
      },
    ]),
  );

  expect(parsed.error).toBeNull();
  expect(parsed.presets[0]?.slashCommand).toBe("legacy-summary");
});
```

- [ ] **Step 2: Write the failing slash-resolution tests**

Add tests to `src/services/presets.test.ts` covering:

```ts
it("resolves visible slash tokens instead of only internal ids", () => {
  const presets = getAllPresets();
  const summarize = presets.find((preset) => preset.id === "summarize");

  expect(summarize?.slashCommand).toBeDefined();
  expect(matchesPresetTokenForTest(summarize!, summarize!.slashCommand!)).toBe(true);
});

it("localizes built-in slash defaults for the Chinese locale", () => {
  vi.mocked(isChineseLocale).mockReturnValue(true);
  const summarize = getAllPresets().find((preset) => preset.id === "summarize");

  expect(summarize?.label).toBe("总结论文");
  expect(summarize?.slashCommand).toBe("总结");
});
```

- [ ] **Step 3: Run the persistence tests to verify failure**

Run:

```bash
npm test -- src/services/settingsManager.test.ts src/services/presets.test.ts
```

Expected: FAIL because `slashCommand` and the new resolution behavior do not exist yet.

- [ ] **Step 4: Add the new internal field and migration logic**

In `src/services/settingsManager.ts`, extend the parsed command shape so it keeps:

```ts
slashCommand?: string;
```

Normalize with these rules:

```ts
const normalizedSlashCommand =
  String(source.slashCommand || source.command || source.id || "").trim();
```

When serializing commands back to storage, include:

```ts
slashCommand: String(preset.slashCommand || "").trim(),
```

- [ ] **Step 5: Update built-in presets to carry visible slash tokens**

In `src/services/presets.ts`, extend `CommandPreset` with:

```ts
slashCommand?: string;
```

Set English built-ins to explicit visible tokens such as:

```ts
slashCommand: "summarize"
slashCommand: "explain"
slashCommand: "contribution"
```

Set Chinese localized built-ins to:

```ts
slashCommand: "总结"
slashCommand: "解释"
slashCommand: "贡献"
slashCommand: "方法"
slashCommand: "局限"
slashCommand: "查证"
slashCommand: "背景"
slashCommand: "相关"
```

Make `getPresetSlashCommand()` return the visible slash token first:

```ts
return (preset.slashCommand || preset.id).trim();
```

- [ ] **Step 6: Re-run the persistence tests**

Run:

```bash
npm test -- src/services/settingsManager.test.ts src/services/presets.test.ts
```

Expected: PASS.

## Task 3: Rewrite The Settings Card Renderer And Auto-save Behavior

**Files:**
- Modify: `src/modules/preferencesPane.ts`
- Test: `src/modules/preferencesPane.test.ts`

- [ ] **Step 1: Write the failing interaction tests**

Add tests covering:

```ts
it("adds a blank custom command card and saves it on blur when valid", () => {
  registerPreferencesPane(createWindow(), deps);

  slashAddButton.dispatch("command");
  expect(customCommandContainer.innerHTML).toContain("data-slash-card-kind=\"custom\"");
});

it("keeps the editor open when the slash token duplicates another command", () => {
  registerPreferencesPane(createWindow(), deps);

  slashAddButton.dispatch("command");
  // simulate duplicate slash + blur
  expect(slashStatus.textContent).toContain("简写不能重复");
});

it("discards a new empty custom card when the user leaves it", () => {
  registerPreferencesPane(createWindow(), deps);

  slashAddButton.dispatch("command");
  // simulate blur without content
  expect(customPresetsField.value).toBe("");
});
```

- [ ] **Step 2: Run the interaction tests to verify failure**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts
```

Expected: FAIL because the current renderer still expects the old custom preset editor.

- [ ] **Step 3: Replace the old custom preset renderer with card sections**

In `src/modules/preferencesPane.ts`, replace the current built-in/custom preset rendering flow with:

```ts
renderSlashSettings(doc, presets)
renderSlashSection({ kind: "builtin", ... })
renderSlashSection({ kind: "custom", ... })
renderSlashCard({ mode: "view" | "edit", ... })
```

The new card editor should render only:

```ts
title
slashCommand
promptPrefix
```

Built-ins also show a `恢复默认` button.
Custom cards show a `删除` button.

- [ ] **Step 4: Implement blur-save and inline validation**

Add editor state that tracks:

```ts
editingCardKey
draftTitle
draftSlashCommand
draftPromptPrefix
draftError
```

On blur:

- if the new custom card is still empty, discard it
- if the draft is valid, persist it
- if invalid, keep the card open and set inline error text

Validation logic should reject:

```ts
!title.trim()
!slashCommand.trim()
!promptPrefix.trim()
duplicateSlashCommand
customCommandCount > 10
```

- [ ] **Step 5: Persist through the existing hidden storage field**

After a successful save, write the updated structured commands back into:

```ts
zotero-ai-assistant-pref-custom-presets
```

Then call the normal `persist()` path so existing settings save flow remains the
single storage boundary.

- [ ] **Step 6: Re-run the interaction tests**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts
```

Expected: PASS.

## Task 4: Re-prove Settings Initialization And Remove The Old Command Path

**Files:**
- Modify: `src/modules/preferencesPane.ts`
- Modify: `src/modules/preferencesPane.test.ts`
- Modify: `addon/content/preferences.xhtml`

- [ ] **Step 1: Write the failing initialization regression test**

Add a test that verifies the slash containers are hydrated on `registerPreferencesPane()`:

```ts
it("hydrates built-in slash cards when the pane loads", () => {
  registerPreferencesPane(createWindow(), deps);

  expect(builtinCommandContainer.innerHTML).toContain("默认命令");
  expect(builtinCommandContainer.innerHTML).toContain("总结论文");
});
```

- [ ] **Step 2: Run the initialization regression test to verify failure**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts -t "hydrates built-in slash cards when the pane loads"
```

Expected: FAIL until the new render path is wired into pane load.

- [ ] **Step 3: Simplify pane load to always render the slash sections immediately**

On `registerPreferencesPane()`:

```ts
hydrateForm(doc, deps.getSettings());
renderSlashSettings(doc, readSlashCommandsFromStorage(doc));
bindSlashSettingsEvents(doc);
```

Do not keep the old JSON preview/apply/copy/docs action bindings.

- [ ] **Step 4: Re-run the initialization regression test**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts -t "hydrates built-in slash cards when the pane loads"
```

Expected: PASS.

## Task 5: Update Smoke Guidance And Run Focused Verification

**Files:**
- Modify: `docs/zotero-dev-smoke-checklist.md`

- [ ] **Step 1: Update the Settings smoke guidance**

In `docs/zotero-dev-smoke-checklist.md`, replace JSON-oriented command checks with:

```md
For slash command validation, prove the installed dev XPI first, then verify:

1. `默认命令` cards render in Settings
2. clicking a built-in card opens `标题` / `简写` / `提示词`
3. clicking away auto-saves valid edits
4. duplicate slash tokens are blocked inline
5. `我的命令` can add and delete commands
6. empty new cards are discarded on blur
7. the custom command limit of 10 is enforced
8. closing and reopening Settings preserves edits
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts src/services/presets.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the broader gate**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Build the packaged dev XPI**

Run:

```bash
npm run build:dev:xpi
npm run verify:xpi
```

Expected: PASS with a dev-numbered XPI artifact.

- [ ] **Step 5: Commit the rewrite**

```bash
git add addon/content/preferences.xhtml addon/locale/en-US/preferences.ftl addon/locale/zh-CN/preferences.ftl src/modules/preferencesPane.ts src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.ts src/services/settingsManager.test.ts src/services/presets.ts src/services/presets.test.ts docs/zotero-dev-smoke-checklist.md docs/superpowers/specs/2026-06-17-ds-copilot-slash-settings-rewrite-design.md docs/superpowers/plans/2026-06-17-ds-copilot-slash-settings-rewrite-plan.md
git commit -m "feat: rewrite slash settings editor"
```

## Spec Coverage Check

- Chinese-first visible slash defaults: covered in Task 2.
- JSON removal from Settings UI: covered in Task 1 and Task 4.
- Card-based built-in and custom editing: covered in Task 3.
- Auto-save on blur and invalid-save blocking: covered in Task 3.
- Custom command cap of 10: covered in Task 3.
- Settings hydration regression: covered in Task 4.
- Docs and smoke guidance updates: covered in Task 5.
