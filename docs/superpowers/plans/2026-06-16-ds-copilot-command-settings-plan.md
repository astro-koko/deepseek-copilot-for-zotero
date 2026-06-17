# Deepseek Copliot Command Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved `Commands and Prompts` Settings redesign without adding a persisted stash model.

**Architecture:** Keep the current `customPresets` preference as the storage boundary. Built-ins remain code-defined in `src/services/presets.ts`; Settings persists only user-created commands plus built-in hides/overrides. JSON import is temporary UI state until the user validates, previews, and applies it into the normal command list. The primary Settings path must not show two competing JSON editors: visual command cards plus one batch-import textarea are the normal UX. Raw storage stays internal in this release.

**Tech Stack:** Zotero preferences XHTML, TypeScript DOM handlers in `src/modules/preferencesPane.ts`, settings/preset helpers in `src/services/settingsManager.ts` and `src/services/presets.ts`, Vitest.

---

## File Structure

- `docs/superpowers/specs/2026-06-16-ds-copilot-command-settings-design.md`: approved PRD/spec, already committed.
- `docs/custom-commands.md`: new GitHub-facing schema and examples page linked from Settings.
- `addon/content/preferences.xhtml`: move command markup below web verification, add import controls and docs link.
- `addon/locale/en-US/preferences.ftl`: English copy for `Commands and Prompts`, import, preview, docs link, status.
- `addon/locale/zh-CN/preferences.ftl`: Chinese copy for the same Settings controls.
- `src/services/settingsManager.ts`: small helpers for import prompt text and command serialization if needed; keep storage compatible.
- `src/services/presets.ts`: rewrite built-in prompt text while preserving ids, aliases, groups, scopes, and home-panel cap.
- `src/modules/preferencesPane.ts`: render visible command cards, bind manual add/restore/import preview/apply/docs-link actions, and avoid serializing untouched built-ins.
- `src/modules/preferencesPane.test.ts`: DOM/event tests for add, restore, import preview/apply, invalid JSON, docs link, prompt copy.
- `src/modules/preferencesPaneSource.test.ts`: source layout tests for section placement and controls.
- `src/modules/preferencesLocaleSource.test.ts`: locale string tests.
- `src/services/settingsManager.test.ts`: serialization/import prompt tests.
- `src/services/presets.test.ts`: built-in prompt/catalog behavior tests.

## Task 1: Source And Locale Skeleton

**Files:**
- Modify: `addon/content/preferences.xhtml`
- Modify: `addon/locale/en-US/preferences.ftl`
- Modify: `addon/locale/zh-CN/preferences.ftl`
- Test: `src/modules/preferencesPaneSource.test.ts`
- Test: `src/modules/preferencesLocaleSource.test.ts`

- [ ] **Step 1: Write failing source tests**

Add tests to `src/modules/preferencesPaneSource.test.ts`:

```ts
it("places Commands and Prompts after web verification settings", () => {
  const evidenceIndex = preferencesSource.indexOf(
    'data-l10n-id="ai-assistant-pref-evidence-description"',
  );
  const commandsIndex = preferencesSource.indexOf(
    'data-l10n-id="ai-assistant-pref-commands-title"',
  );

  expect(evidenceIndex).toBeGreaterThanOrEqual(0);
  expect(commandsIndex).toBeGreaterThan(evidenceIndex);
});

it("includes JSON import, preview, and command docs controls", () => {
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-custom-presets-import"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-custom-presets-import-preview"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-custom-presets-copy-ai-prompt"',
  );
  expect(preferencesSource).toContain(
    'id="zotero-ai-assistant-pref-custom-presets-docs-link"',
  );
});
```

- [ ] **Step 2: Write failing locale tests**

Update `src/modules/preferencesLocaleSource.test.ts`:

```ts
it("labels the commands and prompts section independently", () => {
  expect(enPreferences).toContain(
    "ai-assistant-pref-commands-title = Commands and Prompts",
  );
  expect(zhPreferences).toContain(
    "ai-assistant-pref-commands-title = 命令与提示词",
  );
});

it("labels command import and documentation actions", () => {
  expect(enPreferences).toContain(
    "ai-assistant-pref-custom-presets-import = Import from JSON",
  );
  expect(zhPreferences).toContain(
    "ai-assistant-pref-custom-presets-import = 从 JSON 导入",
  );
  expect(enPreferences).toContain(
    "ai-assistant-pref-custom-presets-copy-ai-prompt = Copy AI prompt",
  );
  expect(zhPreferences).toContain(
    "ai-assistant-pref-custom-presets-copy-ai-prompt = 复制 AI 生成提示词",
  );
  expect(enPreferences).toContain(
    "ai-assistant-pref-custom-presets-docs-link = View JSON examples on GitHub",
  );
  expect(zhPreferences).toContain(
    "ai-assistant-pref-custom-presets-docs-link = 在 GitHub 查看 JSON 示例",
  );
});
```

- [ ] **Step 3: Run failing source/locale tests**

Run:

```bash
npm test -- src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts
```

Expected: FAIL because the new l10n ids and controls do not exist yet.

- [ ] **Step 4: Update XHTML layout**

In `addon/content/preferences.xhtml`, move the existing custom command block so it appears after the Tavily settings block and before later sections. Keep the raw storage textarea hidden, not as a second primary JSON editor. Add:

```xml
<description
  data-l10n-id="ai-assistant-pref-commands-title"
  style="font-weight: 600"
/>
<description data-l10n-id="ai-assistant-pref-commands-help" />
```

Keep the storage textarea `zotero-ai-assistant-pref-custom-presets` hidden from the normal path. Add the single primary import controls:

```xml
<html:details id="zotero-ai-assistant-pref-custom-presets-import">
  <html:summary
    data-l10n-id="ai-assistant-pref-custom-presets-import"
    style="cursor: pointer; user-select: none"
  >
    Import from JSON
  </html:summary>
  <description data-l10n-id="ai-assistant-pref-custom-presets-import-help" />
  <html:div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px">
    <button
      id="zotero-ai-assistant-pref-custom-presets-copy-ai-prompt"
      label="Copy AI prompt"
      data-l10n-id="ai-assistant-pref-custom-presets-copy-ai-prompt"
    />
    <html:a
      id="zotero-ai-assistant-pref-custom-presets-docs-link"
      href="https://github.com/astro-koko/deepseek-copilot-for-zotero/blob/main/docs/custom-commands.md"
      data-l10n-id="ai-assistant-pref-custom-presets-docs-link"
      style="color: #0a66cc; text-decoration: underline; cursor: pointer"
    ></html:a>
  </html:div>
  <html:textarea
    id="zotero-ai-assistant-pref-custom-presets-import-editor"
    spellcheck="false"
    style="min-height: 120px; width: 100%; box-sizing: border-box; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; padding: 8px; border-radius: 6px; margin-top: 6px;"
  ></html:textarea>
  <html:div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px">
    <button
      id="zotero-ai-assistant-pref-custom-presets-validate-import"
      label="Validate and preview"
      data-l10n-id="ai-assistant-pref-custom-presets-validate-import"
    />
    <button
      id="zotero-ai-assistant-pref-custom-presets-apply-import"
      label="Apply import"
      data-l10n-id="ai-assistant-pref-custom-presets-apply-import"
      disabled="disabled"
    />
  </html:div>
  <html:div
    id="zotero-ai-assistant-pref-custom-presets-import-preview"
    style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px"
  ></html:div>
</html:details>
```

- [ ] **Step 5: Update locale copy**

Add English strings:

```text
ai-assistant-pref-commands-title = Commands and Prompts
ai-assistant-pref-commands-help = Add reusable slash commands for your reading workflow. Commands can appear in the slash menu, and a few can be pinned to the sidebar home panel.
ai-assistant-pref-custom-presets-import = Import from JSON
ai-assistant-pref-custom-presets-import-help = Paste JSON generated from the AI prompt, preview the commands, then apply them to your command list.
ai-assistant-pref-custom-presets-copy-ai-prompt = Copy AI prompt
ai-assistant-pref-custom-presets-docs-link = View JSON examples on GitHub
ai-assistant-pref-custom-presets-validate-import = Validate and preview
ai-assistant-pref-custom-presets-apply-import = Apply import
```

Add Chinese strings:

```text
ai-assistant-pref-commands-title = 命令与提示词
ai-assistant-pref-commands-help = 添加适合你阅读流程的 slash 命令。命令会出现在 slash 菜单中，也可以把少量高频命令固定到侧栏首页。
ai-assistant-pref-custom-presets-import = 从 JSON 导入
ai-assistant-pref-custom-presets-import-help = 粘贴用 AI 生成的 JSON，先预览命令，再应用到你的命令列表。
ai-assistant-pref-custom-presets-copy-ai-prompt = 复制 AI 生成提示词
ai-assistant-pref-custom-presets-docs-link = 在 GitHub 查看 JSON 示例
ai-assistant-pref-custom-presets-validate-import = 校验并预览
ai-assistant-pref-custom-presets-apply-import = 应用导入
```

- [ ] **Step 6: Run source/locale tests**

Run:

```bash
npm test -- src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts
```

Expected: PASS.

## Task 2: Command Serialization And Import Prompt Helpers

**Files:**
- Modify: `src/services/settingsManager.ts`
- Test: `src/services/settingsManager.test.ts`

- [ ] **Step 1: Write failing helper tests**

Add imports in `src/services/settingsManager.test.ts`:

```ts
import {
  buildCustomCommandAIPrompt,
  mergeEditableCustomPresets,
  parseEditableCustomPresets,
} from "./settingsManager";
```

Add tests:

```ts
it("builds an AI command JSON prompt that does not end with sentence punctuation", () => {
  const prompt = buildCustomCommandAIPrompt();

  expect(prompt).toContain("JSON array");
  expect(prompt).toContain("promptPrefix");
  expect(prompt.endsWith(".")).toBe(false);
  expect(prompt.endsWith("。")).toBe(false);
});

it("merges imported commands into existing commands by id", () => {
  const existing = parseEditableCustomPresets(
    JSON.stringify([
      {
        id: "future-work",
        label: "Future Work",
        promptPrefix: "Suggest next steps",
        aliases: ["future"],
      },
    ]),
  );
  const imported = parseEditableCustomPresets(
    JSON.stringify([
      {
        id: "future-work",
        label: "Future Work Updated",
        promptPrefix: "Suggest three concrete next studies",
      },
      {
        id: "replication-risk",
        label: "Replication Risk",
        promptPrefix: "Assess replication risks",
      },
    ]),
  );

  expect(mergeEditableCustomPresets(existing, imported).map((preset) => preset.id))
    .toEqual(["future-work", "replication-risk"]);
  expect(mergeEditableCustomPresets(existing, imported)[0]).toMatchObject({
    label: "Future Work Updated",
  });
});
```

- [ ] **Step 2: Run failing helper tests**

Run:

```bash
npm test -- src/services/settingsManager.test.ts
```

Expected: FAIL because the helper exports do not exist.

- [ ] **Step 3: Implement helpers**

Add to `src/services/settingsManager.ts`:

```ts
export function buildCustomCommandAIPrompt(): string {
  return [
    "Create Deepseek Copliot custom slash commands as a JSON array",
    "Output JSON only, with no Markdown fences and no explanation",
    'Each object may include id, label, description, promptPrefix, aliases, scopeHint, showInSidebar, and evidenceHint',
    'Use lower-case hyphenated ids, aliases as an array, and scopeHint values from ["paper","pdf","collection","manual-selection"]',
    "Keep showInSidebar true only for the few commands that should appear on the sidebar home panel",
    "Write promptPrefix text for research reading: be specific, ask for concise structure, separate paper evidence from inference, and ask for uncertainty when relevant",
    "My command ideas are:",
  ].join("\n");
}

export function mergeEditableCustomPresets(
  existing: EditableCustomCommandPreset[],
  imported: EditableCustomCommandPreset[],
): EditableCustomCommandPreset[] {
  const merged = [...existing];
  for (const preset of imported) {
    const index = merged.findIndex((candidate) => candidate.id === preset.id);
    if (index >= 0) {
      merged[index] = preset;
    } else {
      merged.push(preset);
    }
  }
  return merged;
}
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
npm test -- src/services/settingsManager.test.ts
```

Expected: PASS.

## Task 3: Preferences Pane Event Flow

**Files:**
- Modify: `src/modules/preferencesPane.ts`
- Test: `src/modules/preferencesPane.test.ts`

- [ ] **Step 1: Expand fake DOM helpers**

Update `FakeField` in `src/modules/preferencesPane.test.ts` so tests can inspect rendered markup and disabled state:

```ts
class FakeField extends FakeEventTarget {
  value = "";
  disabled = false;
  innerHTML = "";
  textContent = "";
  style = { display: "" };
  querySelectorAll = vi.fn(() => [] as unknown as NodeListOf<Element>);
  querySelector = vi.fn(() => null as Element | null);
  setAttribute(name: string, value: string) {
    if (name === "disabled") {
      this.disabled = true;
    }
    (this as unknown as Record<string, string>)[name] = value;
  }
  removeAttribute(name: string) {
    if (name === "disabled") {
      this.disabled = false;
    }
    delete (this as unknown as Record<string, string>)[name];
  }
}
```

- [ ] **Step 2: Add missing fake elements in createWindow**

Add these test variables and wire them into `createWindow()`:

```ts
let customPresetsEditor: FakeField;
let customPresetsAddButton: FakeButton;
let customPresetsResetButton: FakeButton;
let customPresetsImportEditor: FakeField;
let customPresetsImportPreview: FakeField;
let customPresetsValidateImportButton: FakeButton;
let customPresetsApplyImportButton: FakeButton;
let customPresetsCopyAiPromptButton: FakeButton;
let customPresetsDocsLink: FakeLink;
```

Element ids:

```ts
"zotero-ai-assistant-pref-custom-presets-editor": customPresetsEditor,
"zotero-ai-assistant-pref-custom-presets-add": customPresetsAddButton,
"zotero-ai-assistant-pref-custom-presets-reset": customPresetsResetButton,
"zotero-ai-assistant-pref-custom-presets-import-editor": customPresetsImportEditor,
"zotero-ai-assistant-pref-custom-presets-import-preview": customPresetsImportPreview,
"zotero-ai-assistant-pref-custom-presets-validate-import": customPresetsValidateImportButton,
"zotero-ai-assistant-pref-custom-presets-apply-import": customPresetsApplyImportButton,
"zotero-ai-assistant-pref-custom-presets-copy-ai-prompt": customPresetsCopyAiPromptButton,
"zotero-ai-assistant-pref-custom-presets-docs-link": customPresetsDocsLink,
```

- [ ] **Step 3: Write failing import flow tests**

Add tests:

```ts
it("previews valid imported command JSON without saving immediately", () => {
  registerPreferencesPane(createWindow(), deps);

  customPresetsImportEditor.value = JSON.stringify([
    {
      id: "replication-risk",
      label: "Replication Risk",
      promptPrefix: "Assess replication risks",
      aliases: ["replication"],
    },
  ]);
  customPresetsValidateImportButton.dispatch("command");

  expect(deps.saveSettings).not.toHaveBeenCalled();
  expect(customPresetsImportPreview.innerHTML).toContain("Replication Risk");
  expect(customPresetsApplyImportButton.disabled).toBe(false);
  expect(customPresetsStatus.dataset.variant).toBe("success");
});

it("applies imported commands through the normal custom preset storage", () => {
  registerPreferencesPane(createWindow(), deps);

  customPresetsImportEditor.value = JSON.stringify([
    {
      id: "replication-risk",
      label: "Replication Risk",
      promptPrefix: "Assess replication risks",
    },
  ]);
  customPresetsValidateImportButton.dispatch("command");
  customPresetsApplyImportButton.dispatch("command");

  expect(deps.saveSettings).toHaveBeenLastCalledWith(
    expect.objectContaining({
      customPresets: expect.stringContaining('"id": "replication-risk"'),
    }),
  );
});

it("keeps saved commands untouched when imported JSON is invalid", () => {
  registerPreferencesPane(createWindow(), deps);

  customPresetsImportEditor.value = "[";
  customPresetsValidateImportButton.dispatch("command");

  expect(deps.saveSettings).not.toHaveBeenCalled();
  expect(customPresetsApplyImportButton.disabled).toBe(true);
  expect(customPresetsStatus.dataset.variant).toBe("error");
});
```

- [ ] **Step 4: Write failing copy/docs tests**

Add:

```ts
it("copies the AI generation prompt without terminal punctuation", async () => {
  const writeText = vi.fn(async () => undefined);
  Object.assign(globalThis.navigator ?? {}, {
    clipboard: { writeText },
  });
  registerPreferencesPane(createWindow(), deps);

  customPresetsCopyAiPromptButton.dispatch("command");
  await Promise.resolve();

  expect(writeText).toHaveBeenCalledTimes(1);
  const prompt = writeText.mock.calls[0][0] as string;
  expect(prompt.endsWith(".")).toBe(false);
  expect(prompt.endsWith("。")).toBe(false);
});

it("opens the command JSON documentation link through Zotero.launchURL", () => {
  (Zotero as any).launchURL = vi.fn();
  registerPreferencesPane(createWindow(), deps);

  customPresetsDocsLink.dispatch("click", { preventDefault: vi.fn() });

  expect((Zotero as any).launchURL).toHaveBeenCalledWith(
    "https://github.com/astro-koko/deepseek-copilot-for-zotero/blob/main/docs/custom-commands.md",
  );
});
```

- [ ] **Step 5: Run failing pane tests**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts
```

Expected: FAIL because import/copy/docs handlers do not exist.

- [ ] **Step 6: Implement constants and bindings**

In `src/modules/preferencesPane.ts`, add ids:

```ts
const CUSTOM_PRESETS_IMPORT_EDITOR_ID =
  "zotero-ai-assistant-pref-custom-presets-import-editor";
const CUSTOM_PRESETS_IMPORT_PREVIEW_ID =
  "zotero-ai-assistant-pref-custom-presets-import-preview";
const CUSTOM_PRESETS_VALIDATE_IMPORT_ID =
  "zotero-ai-assistant-pref-custom-presets-validate-import";
const CUSTOM_PRESETS_APPLY_IMPORT_ID =
  "zotero-ai-assistant-pref-custom-presets-apply-import";
const CUSTOM_PRESETS_COPY_AI_PROMPT_ID =
  "zotero-ai-assistant-pref-custom-presets-copy-ai-prompt";
const CUSTOM_PRESETS_DOCS_LINK_ID =
  "zotero-ai-assistant-pref-custom-presets-docs-link";
const CUSTOM_COMMANDS_DOCS_URL =
  "https://github.com/astro-koko/deepseek-copilot-for-zotero/blob/main/docs/custom-commands.md";
```

Import helpers:

```ts
buildCustomCommandAIPrompt,
mergeEditableCustomPresets,
```

Bind buttons in `registerPreferencesPane()`:

```ts
bindButtonActivation(doc, CUSTOM_PRESETS_VALIDATE_IMPORT_ID, () => {
  validateCustomPresetImport(doc);
});
bindButtonActivation(doc, CUSTOM_PRESETS_APPLY_IMPORT_ID, () => {
  applyCustomPresetImport(doc);
  persist();
});
bindButtonActivation(doc, CUSTOM_PRESETS_COPY_AI_PROMPT_ID, () => {
  void copyCustomCommandAIPrompt(doc);
});
bindExternalLink(doc, CUSTOM_PRESETS_DOCS_LINK_ID, CUSTOM_COMMANDS_DOCS_URL);
```

- [ ] **Step 7: Implement import preview/apply helpers**

Add helpers to `src/modules/preferencesPane.ts`:

```ts
let pendingImportPresets: EditableCustomCommandPreset[] = [];

function validateCustomPresetImport(doc: PreferencesDocument): void {
  const field = getField(doc, CUSTOM_PRESETS_IMPORT_EDITOR_ID);
  const preview = doc.getElementById(CUSTOM_PRESETS_IMPORT_PREVIEW_ID) as
    | HTMLElement
    | null;
  const applyButton = getField(doc, CUSTOM_PRESETS_APPLY_IMPORT_ID);
  const value = field?.value || "";
  const parsed = parseCustomPresets(value);
  if (parsed.error) {
    pendingImportPresets = [];
    if (preview) {
      preview.innerHTML = "";
    }
    if (applyButton) {
      applyButton.disabled = true;
      applyButton.setAttribute?.("disabled", "disabled");
    }
    setStatusText(getCustomPresetsStatusElement(doc), parsed.error, "error");
    return;
  }

  pendingImportPresets = parseEditableCustomPresets(value);
  if (preview) {
    preview.innerHTML = pendingImportPresets
      .map((preset, index) =>
        renderCustomPresetCardMarkup({
          index,
          isBuiltIn: false,
          preset,
          zh: isChineseLocale(),
        }),
      )
      .join("");
  }
  if (applyButton) {
    applyButton.disabled = pendingImportPresets.length === 0;
    if (pendingImportPresets.length > 0) {
      applyButton.removeAttribute?.("disabled");
    } else {
      applyButton.setAttribute?.("disabled", "disabled");
    }
  }
  const zh = isChineseLocale();
  setStatusText(
    getCustomPresetsStatusElement(doc),
    zh
      ? `已预览 ${pendingImportPresets.length} 个命令`
      : `Previewing ${pendingImportPresets.length} commands`,
    "success",
  );
}

function applyCustomPresetImport(doc: PreferencesDocument): void {
  if (pendingImportPresets.length === 0) {
    return;
  }
  const merged = mergeEditableCustomPresets(
    readEditablePresetsFromDom(doc),
    pendingImportPresets,
  );
  pendingImportPresets = [];
  renderCustomPresetEditor(doc, merged);
  syncCustomPresetStorageField(doc);
}
```

Also add:

```ts
function getCustomPresetsStatusElement(
  doc: PreferencesDocument,
): PreferencesStatusElement | null {
  return doc.getElementById(
    CUSTOM_PRESETS_STATUS_ID,
  ) as PreferencesStatusElement | null;
}
```

- [ ] **Step 8: Implement prompt copy helper**

Add:

```ts
async function copyCustomCommandAIPrompt(doc: PreferencesDocument): Promise<void> {
  const prompt = buildCustomCommandAIPrompt();
  const clipboard = (globalThis.navigator as { clipboard?: { writeText?: (text: string) => Promise<void> } } | undefined)
    ?.clipboard;
  if (typeof clipboard?.writeText !== "function") {
    setStatusText(
      getCustomPresetsStatusElement(doc),
      isChineseLocale()
        ? "当前环境无法写入剪贴板"
        : "Clipboard is not available",
      "error",
    );
    return;
  }
  await clipboard.writeText(prompt);
  setStatusText(
    getCustomPresetsStatusElement(doc),
    isChineseLocale()
      ? "AI 生成提示词已复制"
      : "AI generation prompt copied",
    "success",
  );
}
```

- [ ] **Step 9: Fix DOM serialization so untouched built-ins are not persisted**

In `readEditablePresetsFromDom()`, skip cards where `data-custom-preset-built-in="true"` and no enabled checkbox exists. Preserve hidden/customized cards that do have editable state. Use:

```ts
const isBuiltIn = card.getAttribute("data-custom-preset-built-in") === "true";
const enabledField = card.querySelector(
  '[data-custom-preset-field="enabled"]',
) as PreferencesFieldElement | null;
if (isBuiltIn && !enabledField) {
  return null;
}
```

Return `.filter(Boolean)` typed as `EditableCustomCommandPreset[]`.

- [ ] **Step 10: Run pane tests**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts
```

Expected: PASS.

## Task 4: Built-in Prompt Rewrite And Catalog Tests

**Files:**
- Modify: `src/services/presets.ts`
- Test: `src/services/presets.test.ts`

- [ ] **Step 1: Add prompt quality tests**

Update tests that currently assert exact old prompt snippets. Use stable quality markers:

```ts
it("uses stronger built-in prompts that separate evidence from inference", () => {
  const summarize = getPresetsForScope("paper").find(
    (preset) => preset.id === "summarize",
  );
  const verify = getPresetsForScope("paper").find(
    (preset) => preset.id === "verify-claim",
  );

  expect(summarize?.promptPrefix).toContain("Distinguish");
  expect(summarize?.promptPrefix).toContain("paper directly states");
  expect(verify?.promptPrefix).toContain("external verification");
});
```

Update `applyPreset` and `expandSlashCommandInput` tests to assert new stable snippets rather than the old sentence:

```ts
expect(prompt).toContain("Summarize this paper for an active researcher");
```

- [ ] **Step 2: Run failing preset tests**

Run:

```bash
npm test -- src/services/presets.test.ts
```

Expected: FAIL until prompt text is rewritten.

- [ ] **Step 3: Rewrite English built-in promptPrefix values**

Keep ids, labels, aliases, group, `showInSidebar`, `scopeHint`, and `evidenceHint` stable. Replace only `description` and `promptPrefix` where useful. Example for `summarize`:

```ts
promptPrefix:
  "Summarize this paper for an active researcher. Use short sections for research question, method, key findings, and why it matters. Distinguish what the paper directly states from your interpretation, and name any important uncertainty or missing context",
```

Use the same pattern for `explain`, `core-contribution`, `method`, `limitations`, `verify-claim`, `background`, and `related-work`.

- [ ] **Step 4: Rewrite Chinese localized prompts**

Update the `zhMap` promptPrefix strings with matching intent. Example:

```ts
promptPrefix:
  "请面向正在读论文的研究者总结这篇论文。用简短小节说明研究问题、方法、关键发现和意义。请区分论文直接陈述的内容与你的解释，并指出重要不确定性或缺失背景",
```

- [ ] **Step 5: Run preset tests**

Run:

```bash
npm test -- src/services/presets.test.ts
```

Expected: PASS.

## Task 5: GitHub Documentation

**Files:**
- Create: `docs/custom-commands.md`

- [ ] **Step 1: Create command docs**

Create `docs/custom-commands.md` with:

```md
# Custom Commands

Deepseek Copliot custom commands are reusable slash commands for common reading workflows. The normal path is to add and edit commands in Zotero Settings. JSON import is for creating several commands at once.

## JSON Shape

Paste a JSON array into `Settings -> Deepseek Copliot -> Commands and Prompts -> Import from JSON`.

```json
[
  {
    "id": "replication-risk",
    "label": "Replication Risk",
    "description": "Assess whether the result is likely to replicate",
    "promptPrefix": "Assess the main replication risks for this paper. Separate evidence from the paper, assumptions you infer, and checks that would require external verification",
    "aliases": ["replication", "robustness"],
    "scopeHint": ["paper", "pdf"],
    "showInSidebar": false,
    "evidenceHint": true
  }
]
```

## Fields

- `id`: lower-case slash command id, such as `replication-risk`
- `label`: display name
- `description`: short helper text
- `promptPrefix`: text inserted before the user's message
- `aliases`: optional slash-menu search aliases
- `scopeHint`: any of `paper`, `pdf`, `collection`, or `manual-selection`
- `showInSidebar`: whether the command may appear on the sidebar home panel
- `evidenceHint`: whether the command should lean toward web verification

## AI Prompt

Use the `Copy AI prompt` button in Zotero Settings, then add your own command ideas below it.
```

- [ ] **Step 2: Check docs path is linked in XHTML**

Run:

```bash
rg -n "docs/custom-commands.md" addon/content/preferences.xhtml docs/custom-commands.md
```

Expected: both files are listed.

## Task 6: Focused And Broader Verification

**Files:**
- No new files unless a verification note is added to an issue or PR.

- [ ] **Step 1: Run focused settings/command gate**

Run:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts src/services/presets.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader logic gate**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Build dev XPI**

Run:

```bash
npm run build:dev:xpi
```

Expected: PASS and a dev XPI under `.scaffold/build`.

- [ ] **Step 4: Verify packaged artifact**

Run:

```bash
npm run verify:xpi
```

Expected: PASS.

- [ ] **Step 5: Record real Zotero smoke needs**

Before final completion, report that packaged real Zotero smoke still needs:

- import the newest local dev, non-stable XPI through Zotero's native Add-ons manager with `Install Plugin From File...`, never through Add-on Market / 插件市场
- verify the installed Add-ons entry or installed XPI manifest version/hash matches the newly built dev XPI before testing Settings
- Settings opens
- `Commands and Prompts` appears below web verification
- manual command save/reopen persists
- import JSON validate/preview/apply persists
- invalid JSON does not overwrite saved commands
- hide and restore one built-in works
- only one primary JSON textarea is visible; no Advanced JSON/raw storage editor is shown in Settings
- cold restart preserves command state
- Library and Reader right-side pane discovery surfaces are unchanged

## Self-Review Notes

- Spec coverage: The plan covers section placement, no persisted stash, AI import preview/apply, GitHub docs link, built-in prompt rewrite, tests, and real Zotero smoke.
- Scope check: The plan stays inside the settings lane and preset helpers. It does not touch Reader, provider, branding, or release metadata.
- Type consistency: New helper names are `buildCustomCommandAIPrompt` and `mergeEditableCustomPresets`; DOM ids use the `zotero-ai-assistant-pref-custom-presets-*` prefix.
