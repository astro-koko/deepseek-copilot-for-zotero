import {
  createEmptyEditableCustomPreset,
  DEFAULT_EVIDENCE_PROVIDER_MODE,
  parseEditableCustomPresets,
  type PersistedSettings,
  stringifyEditableCustomPresets,
  getSettings,
  parseCustomPresets,
  saveSettings,
  type EditableCustomCommandPreset,
  validateEvidenceSettings,
  validateSettings,
} from "../services/settingsManager";
import { createHostEvent } from "../utils/domEvents";
import { EventBus } from "../utils/eventBus";
import { isChineseLocale } from "../utils/locale";
import { getAllPresets, getPresetSlashCommand } from "../services/presets";

type PreferencesWindow = Window & {
  document: PreferencesDocument;
};

type PreferencesDocument = Document & {
  l10n?: {
    formatValue?: (id: string) => Promise<string> | string;
  } | null;
};

type PreferencesRootElement = HTMLElement;

interface PreferencesFieldElement extends HTMLElement {
  value: string;
  disabled?: boolean;
  checked?: boolean;
  __aiAssistantListeners?: Map<string, EventListener>;
}

interface PreferencesInteractiveElement extends HTMLElement {
  __aiAssistantListeners?: Map<string, EventListener>;
}

interface PreferencesStatusElement extends HTMLElement {
  dataset: DOMStringMap & {
    variant?: string;
  };
}

export interface PreferencesPaneDeps {
  getSettings: typeof getSettings;
  saveSettings: typeof saveSettings;
  validateSettings: typeof validateSettings;
  validateEvidenceSettings: typeof validateEvidenceSettings;
}

const ROOT_ID = "zotero-ai-assistant-prefs";
const API_KEY_ID = "zotero-ai-assistant-pref-api-key";
const API_KEY_LINK_ID = "zotero-ai-assistant-pref-api-key-link";
const SAVE_BUTTON_ID = "zotero-ai-assistant-pref-save";
const VALIDATE_BUTTON_ID = "zotero-ai-assistant-pref-validate";
const STATUS_ID = "zotero-ai-assistant-pref-status";
const EVIDENCE_PROVIDER_ID = "zotero-ai-assistant-pref-evidence-provider";
const TAVILY_API_KEY_ID = "zotero-ai-assistant-pref-tavily-api-key";
const TAVILY_LINK_ID = "zotero-ai-assistant-pref-tavily-link";
const TAVILY_VALIDATE_BUTTON_ID = "zotero-ai-assistant-pref-tavily-validate";
const TAVILY_STATUS_ID = "zotero-ai-assistant-pref-tavily-status";
const TAVILY_SETTINGS_ID = "zotero-ai-assistant-pref-tavily-settings";
const CUSTOM_PRESETS_ID = "zotero-ai-assistant-pref-custom-presets";
const CUSTOM_PRESETS_ADD_ID = "zotero-ai-assistant-pref-custom-presets-add";
const CUSTOM_PRESETS_EDITOR_ID =
  "zotero-ai-assistant-pref-custom-presets-editor";
const CUSTOM_PRESETS_PREVIEW_ID =
  "zotero-ai-assistant-pref-custom-presets-preview";
const CUSTOM_PRESETS_RESET_ID =
  "zotero-ai-assistant-pref-custom-presets-reset";
const CUSTOM_PRESETS_STATUS_ID =
  "zotero-ai-assistant-pref-custom-presets-status";

export const DEEPSEEK_PLATFORM_URL = "https://platform.deepseek.com/";
export const TAVILY_APP_URL = "https://app.tavily.com/";

export function registerPreferencesPane(
  win: Window,
  deps: PreferencesPaneDeps = {
    getSettings,
    saveSettings,
    validateEvidenceSettings,
    validateSettings,
  },
): void {
  const doc = win.document as PreferencesDocument;
  const root = doc.getElementById(ROOT_ID) as PreferencesRootElement | null;
  if (!root) {
    return;
  }

  hydrateForm(doc, deps.getSettings());

  const persist = () => {
    syncCustomPresetStorageField(doc);
    const values = readFormValues(doc);
    const customPresetsResult = parseCustomPresets(values.customPresets || "");
    if (customPresetsResult.error) {
      const zh = isChineseLocale();
      updateCustomPresetsStatus(doc, values.customPresets || "");
      setStatusText(
        getStatusElement(doc),
        zh
          ? `自定义命令 JSON 无效，未保存：${customPresetsResult.error}`
          : `Custom commands JSON is invalid; not saved: ${customPresetsResult.error}`,
        "error",
      );
      return;
    }

    deps.saveSettings(values);
    applyEvidenceProviderVisibility(doc, values.evidenceProviderMode);
    updateCustomPresetsStatus(doc, values.customPresets || "");
    EventBus.getInstance().dispatchEvent(
      createHostEvent("settingsChange", win),
    );
    const formatter = doc.l10n?.formatValue;
    const status = getStatusElement(doc);
    if (!status) {
      return;
    }

    status.dataset.variant = "success";
    if (!formatter) {
      status.textContent = "ai-assistant-pref-status-saved";
      return;
    }

    const formatted = formatter("ai-assistant-pref-status-saved");
    if (typeof (formatted as Promise<string>)?.then === "function") {
      void Promise.resolve(formatted).then((value) => {
        status.textContent = String(value);
      });
      return;
    }

    status.textContent = String(formatted);
  };

  const validate = async () => {
    const values = readFormValues(doc);
    const zh = isChineseLocale();
    setStatusText(
      getStatusElement(doc),
      zh ? "正在验证连接..." : "Validating connection...",
      "success",
    );
    const result = await deps.validateSettings(values);
    if (result.valid) {
      setStatusText(
        getStatusElement(doc),
        zh ? "DeepSeek 连接正常" : "DeepSeek connection looks good",
        "success",
      );
      showValidationDialog(
        win,
        zh ? "Deepseek Copliot" : "Deepseek Copliot",
        zh ? "DeepSeek 连接正常" : "DeepSeek connection looks good",
      );
      return;
    }

    setStatusText(
      getStatusElement(doc),
      result.error || (zh ? "验证失败" : "Validation failed"),
      "error",
    );
    showValidationDialog(
      win,
      zh ? "Deepseek Copliot 验证失败" : "Deepseek Copliot Validation Failed",
      result.error || (zh ? "验证失败" : "Validation failed"),
    );
  };

  const validateEvidence = async () => {
    const values = readFormValues(doc);
    const zh = isChineseLocale();
    setStatusText(
      getEvidenceStatusElement(doc),
      zh ? "正在验证 Tavily..." : "Validating Tavily...",
      "success",
    );
    const result = await deps.validateEvidenceSettings(values);
    if (result.valid) {
      setStatusText(
        getEvidenceStatusElement(doc),
        zh ? "Tavily 连接正常" : "Tavily connection looks good",
        "success",
      );
      return;
    }

    setStatusText(
      getEvidenceStatusElement(doc),
      result.error || (zh ? "Tavily 验证失败" : "Tavily validation failed"),
      "error",
    );
  };

  bindFieldEvent(doc, API_KEY_ID, "change", persist);
  bindFieldEvent(doc, CUSTOM_PRESETS_ID, "change", persist);
  bindButtonActivation(doc, CUSTOM_PRESETS_ADD_ID, () => {
    addCustomPresetCard(doc);
    persist();
  });
  bindButtonActivation(doc, CUSTOM_PRESETS_RESET_ID, () => {
    renderCustomPresetEditor(doc, []);
    persist();
  });
  bindTriggeredFieldEvents(
    doc,
    EVIDENCE_PROVIDER_ID,
    ["change", "command"],
    persist,
  );
  bindFieldEvent(doc, TAVILY_API_KEY_ID, "change", persist);
  bindExternalLink(doc, API_KEY_LINK_ID, DEEPSEEK_PLATFORM_URL);
  bindExternalLink(doc, TAVILY_LINK_ID, TAVILY_APP_URL);
  bindButtonActivation(doc, SAVE_BUTTON_ID, persist);
  bindButtonActivation(doc, VALIDATE_BUTTON_ID, () => {
    void validate();
  });
  bindButtonActivation(doc, TAVILY_VALIDATE_BUTTON_ID, () => {
    void validateEvidence();
  });
}

function hydrateForm(
  doc: PreferencesDocument,
  settings: ReturnType<typeof getSettings>,
): void {
  const apiKeyField = getField(doc, API_KEY_ID);
  const customPresetsField = getField(doc, CUSTOM_PRESETS_ID);
  const evidenceProviderField = getField(doc, EVIDENCE_PROVIDER_ID);
  const tavilyApiKeyField = getField(doc, TAVILY_API_KEY_ID);

  if (apiKeyField) {
    apiKeyField.value = settings.apiKey;
  }
  if (customPresetsField) {
    customPresetsField.value = settings.customPresets;
    renderCustomPresetEditor(
      doc,
      parseEditableCustomPresets(settings.customPresets),
    );
    updateCustomPresetsPreview(doc, settings.customPresets);
    updateCustomPresetsStatus(doc, settings.customPresets);
  }
  if (evidenceProviderField) {
    evidenceProviderField.value = settings.evidenceProviderMode;
  }
  if (tavilyApiKeyField) {
    tavilyApiKeyField.value = settings.tavilyApiKey;
  }
  applyEvidenceProviderVisibility(doc, settings.evidenceProviderMode);
}

function readFormValues(doc: PreferencesDocument): Partial<PersistedSettings> {
  const apiKeyField = getField(doc, API_KEY_ID);
  const customPresetsField = getField(doc, CUSTOM_PRESETS_ID);
  const evidenceProviderField = getField(doc, EVIDENCE_PROVIDER_ID);
  const tavilyApiKeyField = getField(doc, TAVILY_API_KEY_ID);

  return {
    apiKey: apiKeyField?.value?.trim?.() ?? "",
    customPresets: customPresetsField?.value ?? "",
    evidenceProviderMode:
      evidenceProviderField?.value === "tavily"
        ? "tavily"
        : DEFAULT_EVIDENCE_PROVIDER_MODE,
    tavilyApiKey: tavilyApiKeyField?.value?.trim?.() ?? "",
  };
}

function updateCustomPresetsStatus(
  doc: PreferencesDocument,
  customPresetsValue: string,
): void {
  const status = doc.getElementById(
    CUSTOM_PRESETS_STATUS_ID,
  ) as PreferencesStatusElement | null;
  if (!status) {
    return;
  }

  const zh = isChineseLocale();
  const parsed = parseCustomPresets(customPresetsValue);
  if (parsed.error) {
    setStatusText(status, parsed.error, "error");
    return;
  }

  if (!customPresetsValue.trim()) {
    setStatusText(
      status,
      zh ? "还没有自定义命令" : "No custom commands yet",
      "success",
    );
    return;
  }

  setStatusText(
    status,
    zh
      ? `已读取 ${parsed.presets.length} 个自定义命令`
      : `Loaded ${parsed.presets.length} custom commands`,
    "success",
  );
}

function renderCustomPresetEditor(
  doc: PreferencesDocument,
  presets: EditableCustomCommandPreset[],
): void {
  const container = doc.getElementById(CUSTOM_PRESETS_EDITOR_ID) as
    | HTMLElement
    | null;
  if (!container) {
    return;
  }

  const zh = isChineseLocale();
  const rows = presets.length > 0 ? presets : [];
  const builtInPresets = getAllPresets().map((preset) => ({
    aliasesText: preset.aliases.join(", "),
    description: preset.description,
    enabled: false,
    evidenceHint: Boolean(preset.evidenceHint),
    group: preset.group,
    hidden: false,
    id: preset.id,
    label: preset.label,
    promptPrefix: preset.promptPrefix,
    showInSidebar: Boolean(preset.showInSidebar),
    scopeHint: preset.scopeHint || ["paper", "pdf"],
  }));
  const builtInPresetIds = new Set(builtInPresets.map((preset) => preset.id));
  const storedRows = rows.filter((preset) => preset.enabled || preset.hidden);
  const builtInCards = builtInPresets.map(
    (preset) => storedRows.find((row) => row.id === preset.id) || preset,
  );
  const customCards = storedRows.filter(
    (preset) => !builtInPresetIds.has(preset.id),
  );

  container.innerHTML = [
    renderCustomPresetSectionMarkup({
      cards: builtInCards,
      description: zh
        ? "管理内置 slash 命令。你可以直接复制后编辑、隐藏命令，或固定到首页推荐位。"
        : "Manage the built-in slash commands. You can customize, hide, or pin them to the home panel.",
      emptyState: "",
      isBuiltInSection: true,
      title: zh ? "内置命令" : "Built-in commands",
      zh,
    }),
    renderCustomPresetSectionMarkup({
      cards: customCards,
      description: zh
        ? "添加你自己的 slash 命令。新增后可直接修改标题、提示词和首页展示。"
        : "Add your own slash commands here. New commands can be edited directly and pinned to the home panel.",
      emptyState: zh
        ? "还没有自定义命令，点击“添加自定义命令”开始。"
        : "No custom commands yet. Use Add custom command to create one.",
      isBuiltInSection: false,
      title: zh ? "自定义命令" : "Custom commands",
      zh,
    }),
  ].join("");

  bindCustomPresetEditorEvents(doc);
}

function renderCustomPresetSectionMarkup({
  cards,
  description,
  emptyState,
  isBuiltInSection,
  title,
  zh,
}: {
  cards: EditableCustomCommandPreset[];
  description: string;
  emptyState: string;
  isBuiltInSection: boolean;
  title: string;
  zh: boolean;
}): string {
  const content = cards.length
    ? cards
        .map((preset, index) =>
          renderCustomPresetCardMarkup({
            index,
            isBuiltIn: isBuiltInSection,
            preset,
            zh,
          }),
        )
        .join("")
    : `<div style="border: 1px dashed rgba(0,0,0,0.18); border-radius: 8px; padding: 12px; color: rgba(0,0,0,0.62);">${escapeHtml(
        emptyState,
      )}</div>`;

  return `
    <section style="display: flex; flex-direction: column; gap: 10px;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <strong>${escapeHtml(title)}</strong>
        <span style="opacity: 0.78;">${escapeHtml(description)}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${content}
      </div>
    </section>
  `;
}

function renderCustomPresetCardMarkup({
  index,
  isBuiltIn,
  preset,
  zh,
}: {
  index: number;
  isBuiltIn: boolean;
  preset: EditableCustomCommandPreset;
  zh: boolean;
}): string {
  const editable = Boolean(preset.enabled || preset.hidden);
  const scopes = new Set(preset.scopeHint);
  const slash = getPresetSlashCommand({ id: preset.id });
  const escapedPrompt = escapeHtml(preset.promptPrefix);
  const escapedAliases = escapeHtml(preset.aliasesText);
  const escapedDescription = escapeHtml(preset.description);
  const escapedGroup = escapeHtml(preset.group);
  const escapedId = escapeHtml(preset.id);
  const escapedLabel = escapeHtml(preset.label);
  const statusBadges = buildPresetStatusBadges({ editable, isBuiltIn, preset, zh });
  return `
    <div data-custom-preset-card="${index}" data-custom-preset-built-in="${isBuiltIn ? "true" : "false"}" style="border: 1px solid rgba(0,0,0,0.12); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 10px; background: ${preset.hidden ? "rgba(0,0,0,0.02)" : "#fff"};">
      <div style="display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <strong>${isBuiltIn ? (zh ? "内置命令" : "Built-in command") : zh ? "自定义命令" : "Custom command"}</strong>
          <span style="opacity: 0.72;">/${escapeHtml(slash)}</span>
        </div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${statusBadges}
        </div>
      </div>
      <input type="hidden" data-custom-preset-field="group" data-custom-preset-index="${index}" value="${escapedGroup}" />
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <label style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 160px;">
          <span>${zh ? "命令 ID" : "Command ID"}</span>
          <input data-custom-preset-field="id" data-custom-preset-index="${index}" value="${escapedId}" ${editable ? "" : 'readonly="readonly"'} />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px;">
          <span>${zh ? "显示标题" : "Label"}</span>
          <input data-custom-preset-field="label" data-custom-preset-index="${index}" value="${escapedLabel}" ${editable ? "" : 'readonly="readonly"'} />
        </label>
      </div>
      <label style="display: flex; flex-direction: column; gap: 4px;">
        <span>${zh ? "提示词模板" : "Prompt template"}</span>
        <textarea data-custom-preset-field="promptPrefix" data-custom-preset-index="${index}" style="min-height: 84px;" ${editable ? "" : 'readonly="readonly"'}>${escapedPrompt}</textarea>
      </label>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <label style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px;">
          <span>${zh ? "说明文案" : "Description"}</span>
          <input data-custom-preset-field="description" data-custom-preset-index="${index}" value="${escapedDescription}" ${editable ? "" : 'readonly="readonly"'} />
        </label>
        <label style="display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px;">
          <span>${zh ? "别名（逗号分隔）" : "Aliases (comma separated)"}</span>
          <input data-custom-preset-field="aliasesText" data-custom-preset-index="${index}" value="${escapedAliases}" ${editable ? "" : 'readonly="readonly"'} />
        </label>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
        <label><input type="checkbox" data-custom-preset-field="scope-paper" data-custom-preset-index="${index}" ${scopes.has("paper") ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> ${zh ? "论文" : "Paper"}</label>
        <label><input type="checkbox" data-custom-preset-field="scope-pdf" data-custom-preset-index="${index}" ${scopes.has("pdf") ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> PDF</label>
        <label><input type="checkbox" data-custom-preset-field="scope-collection" data-custom-preset-index="${index}" ${scopes.has("collection") ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> ${zh ? "分类" : "Collection"}</label>
        <label><input type="checkbox" data-custom-preset-field="scope-manual-selection" data-custom-preset-index="${index}" ${scopes.has("manual-selection") ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> ${zh ? "选中文本" : "Selection"}</label>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
        <label><input type="checkbox" data-custom-preset-field="evidenceHint" data-custom-preset-index="${index}" ${preset.evidenceHint ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> ${zh ? "默认开启查证倾向" : "Evidence-oriented"}</label>
        <label><input type="checkbox" data-custom-preset-field="showInSidebar" data-custom-preset-index="${index}" ${preset.showInSidebar ? "checked" : ""} ${editable ? "" : 'disabled="disabled"'} /> ${zh ? "显示在首页推荐位" : "Show on home panel"}</label>
        ${
          editable
            ? `<label><input type="checkbox" data-custom-preset-field="enabled" data-custom-preset-index="${index}" ${preset.hidden ? "" : 'checked="checked"'} /> ${
                zh ? "启用此命令" : "Enable command"
              }</label>
        <button type="button" data-custom-preset-action="remove" data-custom-preset-index="${index}">${preset.hidden ? (zh ? "恢复内置命令" : "Restore built-in command") : isBuiltIn ? (zh ? "恢复默认配置" : "Reset to built-in") : zh ? "删除自定义命令" : "Delete custom command"}</button>`
            : `<button type="button" data-custom-preset-action="copy" data-custom-preset-index="${index}">${
                zh ? "复制后编辑" : "Customize"
              }</button>
        <button type="button" data-custom-preset-action="hide-default" data-custom-preset-index="${index}">${
                zh ? "隐藏此内置命令" : "Hide built-in command"
              }</button>`
        }
      </div>
    </div>
  `;
}

function buildPresetStatusBadges({
  editable,
  isBuiltIn,
  preset,
  zh,
}: {
  editable: boolean;
  isBuiltIn: boolean;
  preset: EditableCustomCommandPreset;
  zh: boolean;
}): string {
  const badges: string[] = [];
  if (isBuiltIn) {
    badges.push(renderPresetBadge(zh ? "内置" : "Built-in"));
  } else {
    badges.push(renderPresetBadge(zh ? "自定义" : "Custom"));
  }
  if (editable && !Boolean(preset.hidden)) {
    badges.push(renderPresetBadge(zh ? "可编辑" : "Editable"));
  }
  if (Boolean(preset.hidden)) {
    badges.push(renderPresetBadge(zh ? "已隐藏" : "Hidden"));
  }
  if (Boolean(preset.showInSidebar)) {
    badges.push(renderPresetBadge(zh ? "首页推荐位" : "Home panel"));
  }
  return badges.join("");
}

function renderPresetBadge(label: string): string {
  return `<span style="display: inline-flex; align-items: center; border: 1px solid rgba(0,0,0,0.14); border-radius: 999px; padding: 2px 8px; font-size: 11px; opacity: 0.82;">${escapeHtml(
    label,
  )}</span>`;
}

function bindCustomPresetEditorEvents(doc: PreferencesDocument): void {
  const container = doc.getElementById(CUSTOM_PRESETS_EDITOR_ID);
  if (!container) {
    return;
  }

  const persistFromEditor = () => {
    syncCustomPresetStorageField(doc);
    const customPresetsField = getField(doc, CUSTOM_PRESETS_ID);
    updateCustomPresetsStatus(doc, customPresetsField?.value || "");
    updateCustomPresetsPreview(doc, customPresetsField?.value || "");
  };

  const fields = container.querySelectorAll(
    "[data-custom-preset-field]",
  ) as NodeListOf<HTMLElement>;
  fields.forEach((field: HTMLElement) => {
    field.addEventListener("change", persistFromEditor);
    field.addEventListener("input", persistFromEditor);
  });

  const actionButtons = container.querySelectorAll(
    "[data-custom-preset-action]",
  ) as NodeListOf<HTMLElement>;
  actionButtons.forEach((button: HTMLElement) => {
    button.addEventListener("click", () => {
      const index = Number(button.getAttribute("data-custom-preset-index"));
      const presets = readEditablePresetsFromDom(doc);
      const action = button.getAttribute("data-custom-preset-action");
      if (action === "copy") {
        const source = presets[index];
        const next = {
          ...source,
          enabled: true,
          hidden: false,
        };
        const existingIndex = presets.findIndex(
          (preset, presetIndex) =>
            preset.enabled && preset.id === next.id && presetIndex !== index,
        );
        if (existingIndex >= 0) {
          presets[existingIndex] = next;
        } else {
          presets.push(next);
        }
      } else if (action === "hide-default") {
        const source = presets[index];
        const next = {
          ...source,
          enabled: true,
          hidden: true,
          showInSidebar: false,
        };
        const existingIndex = presets.findIndex(
          (preset, presetIndex) =>
            preset.id === next.id && presetIndex !== index,
        );
        if (existingIndex >= 0) {
          presets[existingIndex] = next;
        } else {
          presets.push(next);
        }
      } else {
        presets.splice(index, 1);
      }
      renderCustomPresetEditor(doc, presets);
      persistFromEditor();
    });
  });
}

function addCustomPresetCard(doc: PreferencesDocument): void {
  const presets = readEditablePresetsFromDom(doc);
  presets.push(createEmptyEditableCustomPreset(presets.length));
  renderCustomPresetEditor(doc, presets);
}

function readEditablePresetsFromDom(
  doc: PreferencesDocument,
): EditableCustomCommandPreset[] {
  const container = doc.getElementById(CUSTOM_PRESETS_EDITOR_ID);
  if (!container) {
    return [];
  }

  const cards = Array.from(
    container.querySelectorAll("[data-custom-preset-card]"),
  ) as HTMLElement[];

  return cards.map((card, index) => {
    const readValue = (name: string) =>
      (
        card.querySelector(
          `[data-custom-preset-field="${name}"]`,
        ) as PreferencesFieldElement | null
      )?.value || "";
    const readChecked = (name: string) =>
      Boolean(
        (
          card.querySelector(
            `[data-custom-preset-field="${name}"]`,
          ) as PreferencesFieldElement | null
        )?.checked,
      );

    const scopeHint = [
      readChecked("scope-paper") ? "paper" : null,
      readChecked("scope-pdf") ? "pdf" : null,
      readChecked("scope-collection") ? "collection" : null,
      readChecked("scope-manual-selection") ? "manual-selection" : null,
    ].filter(Boolean) as EditableCustomCommandPreset["scopeHint"];

    return {
      aliasesText: readValue("aliasesText"),
      description: readValue("description"),
      enabled: readChecked("enabled"),
      evidenceHint: readChecked("evidenceHint"),
      group:
        (readValue("group") as EditableCustomCommandPreset["group"]) ||
        "reading",
      hidden: !readChecked("enabled"),
      id: readValue("id") || `custom-action-${index + 1}`,
      label: readValue("label"),
      promptPrefix: readValue("promptPrefix"),
      showInSidebar: readChecked("showInSidebar"),
      scopeHint: scopeHint.length > 0 ? scopeHint : ["paper", "pdf"],
    };
  });
}

function syncCustomPresetStorageField(doc: PreferencesDocument): void {
  const container = doc.getElementById(CUSTOM_PRESETS_EDITOR_ID) as
    | (HTMLElement & {
        querySelectorAll?: (selector: string) => NodeListOf<Element>;
      })
    | null;
  const field = getField(doc, CUSTOM_PRESETS_ID);
  if (!field || !container?.querySelectorAll) {
    return;
  }

  const serialized = stringifyEditableCustomPresets(
    readEditablePresetsFromDom(doc),
  );
  field.value = serialized;
  updateCustomPresetsPreview(doc, serialized);
}

function updateCustomPresetsPreview(
  doc: PreferencesDocument,
  customPresetsValue: string,
): void {
  const preview = getField(doc, CUSTOM_PRESETS_PREVIEW_ID);
  if (!preview) {
    return;
  }

  preview.value = customPresetsValue;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function applyEvidenceProviderVisibility(
  doc: PreferencesDocument,
  providerMode: Partial<PersistedSettings>["evidenceProviderMode"] = DEFAULT_EVIDENCE_PROVIDER_MODE,
): void {
  const tavilySettings = doc.getElementById(TAVILY_SETTINGS_ID) as
    | (HTMLElement & { style?: { display?: string } })
    | null;
  if (!tavilySettings?.style) {
    return;
  }

  tavilySettings.style.display = providerMode === "tavily" ? "" : "none";
}

function getField(
  doc: PreferencesDocument,
  id: string,
):
  | (PreferencesFieldElement & {
      removeEventListener?(
        type: string,
        listener: (...args: any[]) => void,
      ): void;
      addEventListener(type: string, listener: (...args: any[]) => void): void;
    })
  | null {
  return doc.getElementById(id) as any;
}

function getInteractiveElement(
  doc: PreferencesDocument,
  id: string,
):
  | (PreferencesInteractiveElement & {
      removeEventListener?(
        type: string,
        listener: (...args: any[]) => void,
      ): void;
      addEventListener(type: string, listener: (...args: any[]) => void): void;
    })
  | null {
  return doc.getElementById(id) as any;
}

function bindFieldEvent(
  doc: PreferencesDocument,
  id: string,
  type: string,
  listener: (event?: Event) => void,
): void {
  const field = getInteractiveElement(doc, id);
  if (!field) {
    return;
  }

  const listeners =
    field.__aiAssistantListeners ?? new Map<string, EventListener>();
  const previous = listeners.get(type);
  if (previous && typeof field.removeEventListener === "function") {
    field.removeEventListener(type, previous);
  }

  const eventListener = ((event: Event) => listener(event)) as EventListener;
  field.addEventListener(type, eventListener);
  listeners.set(type, eventListener);
  field.__aiAssistantListeners = listeners;
}

function bindTriggeredFieldEvents(
  doc: PreferencesDocument,
  id: string,
  types: string[],
  listener: () => void,
): void {
  const field = getInteractiveElement(doc, id);
  if (!field) {
    return;
  }

  let scheduledToken = 0;
  const invoke = () => {
    const token = ++scheduledToken;
    void Promise.resolve().then(() => {
      if (token !== scheduledToken) {
        return;
      }
      listener();
    });
  };

  const listeners =
    field.__aiAssistantListeners ?? new Map<string, EventListener>();
  for (const type of types) {
    const listenerKey = `trigger:${type}`;
    const previous = listeners.get(listenerKey);
    if (previous && typeof field.removeEventListener === "function") {
      field.removeEventListener(type, previous);
    }

    const eventListener = (() => invoke()) as EventListener;
    field.addEventListener(type, eventListener);
    listeners.set(listenerKey, eventListener);
  }

  field.__aiAssistantListeners = listeners;
}

function bindButtonActivation(
  doc: PreferencesDocument,
  id: string,
  listener: () => void,
): void {
  let scheduledClickToken = 0;
  const invokeFromClick = () => {
    const token = ++scheduledClickToken;
    void Promise.resolve().then(() => {
      if (token !== scheduledClickToken) {
        return;
      }
      scheduledClickToken = 0;
      listener();
    });
  };
  const invokeFromCommand = () => {
    scheduledClickToken = 0;
    listener();
  };

  bindFieldEvent(doc, id, "command", invokeFromCommand);
  bindFieldEvent(doc, id, "click", invokeFromClick);
}

function bindExternalLink(
  doc: PreferencesDocument,
  id: string,
  href: string,
): void {
  bindFieldEvent(doc, id, "click", (event) => {
    openPreferencesLink(
      href,
      event as { preventDefault?: () => void } | undefined,
    );
  });
}

export function openPreferencesLink(
  href: string,
  event?: { preventDefault?: () => void },
): void {
  const launchURL = (
    globalThis as { Zotero?: { launchURL?: (url: string) => void } }
  ).Zotero?.launchURL;
  if (typeof launchURL !== "function") {
    return;
  }

  event?.preventDefault?.();
  launchURL(href);
}

function setStatusText(
  status: PreferencesStatusElement | null,
  value: string,
  variant: "success" | "error",
): void {
  if (!status) {
    return;
  }

  status.dataset.variant = variant;
  status.textContent = value;
}

function getStatusElement(
  doc: PreferencesDocument,
): PreferencesStatusElement | null {
  return doc.getElementById(STATUS_ID) as PreferencesStatusElement | null;
}

function getEvidenceStatusElement(
  doc: PreferencesDocument,
): PreferencesStatusElement | null {
  return doc.getElementById(
    TAVILY_STATUS_ID,
  ) as PreferencesStatusElement | null;
}

function showValidationDialog(
  win: Window,
  title: string,
  message: string,
): void {
  try {
    Zotero.alert(win, title, message);
  } catch (error) {
    ztoolkit.log("Failed to show validation dialog:", error);
  }
}
