import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerPreferencesPane,
  type PreferencesPaneDeps,
} from "./preferencesPane";
import { EventBus } from "../utils/eventBus";
import { debugLog } from "../utils/debugLog";

class FakeEventTarget {
  listeners = new Map<string, Set<(...args: any[]) => void>>();

  addEventListener(type: string, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (...args: any[]) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Record<string, unknown> = {}) {
    this.listeners.get(type)?.forEach((listener) =>
      listener({
        type,
        preventDefault: vi.fn(),
        ...event,
      }),
    );
  }

  getListenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

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

class FakeButton extends FakeField {}

class FakeLink extends FakeField {
  href = "";
}

class FakeStatusElement {
  textContent = "";
  dataset: Record<string, string> = {};
}

class FakeRootElement {
  dataset: Record<string, string> = {};
}

class FakeDocument {
  l10n = {
    formatValue: vi.fn(async (id: string) => `l10n:${id}`),
  };

  constructor(private readonly elements: Record<string, unknown>) {}

  getElementById(id: string) {
    return (this.elements[id] as HTMLElement | null) ?? null;
  }
}

class FakeWindow {
  constructor(public document: FakeDocument) {}
}

describe("registerPreferencesPane", () => {
  let root: FakeRootElement;
  let apiKeyField: FakeField;
  let saveButton: FakeButton;
  let validateButton: FakeButton;
  let exportDebugLogButton: FakeButton;
  let status: FakeStatusElement;
  let customPresetsField: FakeField;
  let customPresetsEditor: FakeField;
  let customPresetsAddButton: FakeButton;
  let customPresetsResetButton: FakeButton;
  let customPresetsImportEditor: FakeField;
  let customPresetsImportPreview: FakeField;
  let customPresetsValidateImportButton: FakeButton;
  let customPresetsApplyImportButton: FakeButton;
  let customPresetsCopyAiPromptButton: FakeButton;
  let customPresetsDocsLink: FakeLink;
  let customPresetsStatus: FakeStatusElement;
  let evidenceProviderField: FakeField;
  let tavilyApiKeyField: FakeField;
  let tavilyValidateButton: FakeButton;
  let tavilyStatus: FakeStatusElement;
  let tavilySettingsRow: FakeField;
  let deepSeekLink: FakeLink;
  let tavilyLink: FakeLink;
  let deps: PreferencesPaneDeps;

  beforeEach(() => {
    EventBus.dispose();
    vi.stubGlobal("Zotero", {
      alert: vi.fn(),
      Prefs: {
        get: vi.fn(() => ""),
      },
    });
    root = new FakeRootElement();
    apiKeyField = new FakeField();
    saveButton = new FakeButton();
    validateButton = new FakeButton();
    exportDebugLogButton = new FakeButton();
    status = new FakeStatusElement();
    customPresetsField = new FakeField();
    customPresetsEditor = new FakeField();
    customPresetsAddButton = new FakeButton();
    customPresetsResetButton = new FakeButton();
    customPresetsImportEditor = new FakeField();
    customPresetsImportPreview = new FakeField();
    customPresetsValidateImportButton = new FakeButton();
    customPresetsApplyImportButton = new FakeButton();
    customPresetsCopyAiPromptButton = new FakeButton();
    customPresetsDocsLink = new FakeLink();
    customPresetsStatus = new FakeStatusElement();
    evidenceProviderField = new FakeField();
    tavilyApiKeyField = new FakeField();
    tavilyValidateButton = new FakeButton();
    tavilyStatus = new FakeStatusElement();
    tavilySettingsRow = new FakeField();
    deepSeekLink = new FakeLink();
    tavilyLink = new FakeLink();

    deps = {
      getSettings: vi.fn(() => ({
        apiKey: "sk-test",
        baseURL: "https://api.deepseek.com",
        customPresets: "",
        model: "deepseek-v4-pro",
        maxContextBudget: 8192,
        keyboardShortcut: "I",
        evidenceEnabled: false,
        evidenceProviderMode: "mcp-web-search" as const,
        tavilyApiKey: "",
      })),
      saveSettings: vi.fn(),
      validateSettings: vi.fn(async () => ({ valid: true })),
      validateEvidenceSettings: vi.fn(async () => ({ valid: true })),
      exportDebugLog: vi.fn(async () => "/tmp/deepseek-copliot-debug.jsonl"),
    };
  });

  function createWindow() {
    const document = new FakeDocument({
      "zotero-ai-assistant-prefs": root,
      "zotero-ai-assistant-pref-api-key": apiKeyField,
      "zotero-ai-assistant-pref-save": saveButton,
      "zotero-ai-assistant-pref-validate": validateButton,
      "zotero-ai-assistant-pref-export-debug-log": exportDebugLogButton,
      "zotero-ai-assistant-pref-status": status,
      "zotero-ai-assistant-pref-custom-presets": customPresetsField,
      "zotero-ai-assistant-pref-custom-presets-editor": customPresetsEditor,
      "zotero-ai-assistant-pref-custom-presets-add": customPresetsAddButton,
      "zotero-ai-assistant-pref-custom-presets-reset": customPresetsResetButton,
      "zotero-ai-assistant-pref-custom-presets-import-editor":
        customPresetsImportEditor,
      "zotero-ai-assistant-pref-custom-presets-import-preview":
        customPresetsImportPreview,
      "zotero-ai-assistant-pref-custom-presets-validate-import":
        customPresetsValidateImportButton,
      "zotero-ai-assistant-pref-custom-presets-apply-import":
        customPresetsApplyImportButton,
      "zotero-ai-assistant-pref-custom-presets-copy-ai-prompt":
        customPresetsCopyAiPromptButton,
      "zotero-ai-assistant-pref-custom-presets-docs-link":
        customPresetsDocsLink,
      "zotero-ai-assistant-pref-custom-presets-status": customPresetsStatus,
      "zotero-ai-assistant-pref-evidence-provider": evidenceProviderField,
      "zotero-ai-assistant-pref-tavily-api-key": tavilyApiKeyField,
      "zotero-ai-assistant-pref-tavily-validate": tavilyValidateButton,
      "zotero-ai-assistant-pref-tavily-status": tavilyStatus,
      "zotero-ai-assistant-pref-tavily-settings": tavilySettingsRow,
      "zotero-ai-assistant-pref-api-key-link": deepSeekLink,
      "zotero-ai-assistant-pref-tavily-link": tavilyLink,
    });

    return new FakeWindow(
      document as unknown as FakeDocument,
    ) as unknown as Window;
  }

  it("hydrates field values from settings on load", () => {
    registerPreferencesPane(createWindow(), deps);

    expect(deps.getSettings).toHaveBeenCalledTimes(1);
    expect(apiKeyField.value).toBe("sk-test");
    expect(customPresetsField.value).toBe("");
    expect(evidenceProviderField.value).toBe("mcp-web-search");
  });

  it("binds listeners only once when the pane is reopened", () => {
    const win = createWindow();

    registerPreferencesPane(win, deps);
    apiKeyField.value = "sk-updated";
    evidenceProviderField.value = "tavily";
    registerPreferencesPane(win, deps);
    apiKeyField.dispatch("change");

    expect(apiKeyField.getListenerCount("change")).toBe(1);
    expect(saveButton.getListenerCount("command")).toBe(1);
    expect(validateButton.getListenerCount("command")).toBe(1);
    expect(exportDebugLogButton.getListenerCount("command")).toBe(1);
    expect(evidenceProviderField.getListenerCount("change")).toBe(1);
    expect(evidenceProviderField.getListenerCount("command")).toBe(1);
    expect(tavilyValidateButton.getListenerCount("command")).toBe(1);
    expect(deepSeekLink.getListenerCount("click")).toBe(1);
    expect(tavilyLink.getListenerCount("click")).toBe(1);
    expect(deps.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("opens the DeepSeek and Tavily signup links through Zotero.launchURL", () => {
    (Zotero as any).launchURL = vi.fn();
    registerPreferencesPane(createWindow(), deps);

    const deepSeekEvent = { preventDefault: vi.fn() };
    const tavilyEvent = { preventDefault: vi.fn() };
    deepSeekLink.dispatch("click", deepSeekEvent);
    tavilyLink.dispatch("click", tavilyEvent);

    expect((Zotero as any).launchURL).toHaveBeenNthCalledWith(
      1,
      "https://platform.deepseek.com/",
    );
    expect((Zotero as any).launchURL).toHaveBeenNthCalledWith(
      2,
      "https://app.tavily.com/",
    );
    expect(deepSeekEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(tavilyEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("saves normalized values on change and reports success", async () => {
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-next";

    apiKeyField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).toHaveBeenCalledWith({
      apiKey: "sk-next",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(status.textContent).toBe("l10n:ai-assistant-pref-status-saved");
    expect(status.dataset.variant).toBe("success");
  });

  it("persists user-facing settings while internal defaults remain elsewhere", () => {
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-internal-defaults";
    saveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-internal-defaults",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
  });

  it("persists custom command JSON and reports the parsed count", async () => {
    registerPreferencesPane(createWindow(), deps);

    const customPresets =
      '[{"id":"future-work","label":"Future Work","promptPrefix":"Suggest next steps.","aliases":["future"]}]';
    customPresetsField.value = customPresets;
    customPresetsField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-test",
      customPresets,
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(customPresetsStatus.textContent).toBe(
      "Loaded 1 custom commands",
    );
    expect(customPresetsStatus.dataset.variant).toBe("success");
  });

  it("does not persist invalid custom command JSON", async () => {
    registerPreferencesPane(createWindow(), deps);

    customPresetsField.value = "[";
    customPresetsField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).not.toHaveBeenCalled();
    expect(customPresetsStatus.dataset.variant).toBe("error");
    expect(status.dataset.variant).toBe("error");
    expect(status.textContent).toContain(
      "Custom commands JSON is invalid; not saved",
    );
  });

  it("keeps raw custom command storage internal while still guarding invalid values", async () => {
    const savedPresets = JSON.stringify([
      {
        id: "future-work",
        label: "Future Work",
        promptPrefix: "Suggest next steps",
      },
    ]);
    deps.getSettings = vi.fn(() => ({
      apiKey: "sk-test",
      baseURL: "https://api.deepseek.com",
      customPresets: savedPresets,
      model: "deepseek-v4-pro",
      maxContextBudget: 8192,
      keyboardShortcut: "I",
      evidenceEnabled: false,
      evidenceProviderMode: "mcp-web-search" as const,
      tavilyApiKey: "",
    }));
    registerPreferencesPane(createWindow(), deps);

    customPresetsField.value = "[";
    customPresetsField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).not.toHaveBeenCalled();
    expect(customPresetsStatus.dataset.variant).toBe("error");
    expect(status.dataset.variant).toBe("error");
  });

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

  it("copies the AI generation prompt without terminal punctuation", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    vi.stubGlobal("navigator", {
      clipboard: { writeText },
    });
    registerPreferencesPane(createWindow(), deps);

    customPresetsCopyAiPromptButton.dispatch("command");
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    const prompt = writeText.mock.calls[0]?.[0] ?? "";
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

  it("restores built-in commands without deleting user-created commands", () => {
    deps.getSettings = vi.fn(() => ({
      apiKey: "sk-test",
      baseURL: "https://api.deepseek.com",
      customPresets: JSON.stringify([
        {
          id: "summarize",
          hidden: true,
        },
        {
          id: "future-work",
          label: "Future Work",
          promptPrefix: "Suggest next steps",
        },
      ]),
      model: "deepseek-v4-pro",
      maxContextBudget: 8192,
      keyboardShortcut: "I",
      evidenceEnabled: false,
      evidenceProviderMode: "mcp-web-search" as const,
      tavilyApiKey: "",
    }));
    registerPreferencesPane(createWindow(), deps);

    customPresetsResetButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customPresets: expect.stringContaining('"id": "future-work"'),
      }),
    );
    expect(deps.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customPresets: expect.not.stringContaining('"id": "summarize"'),
      }),
    );
  });

  it("runs validation with unsaved values and reports errors inline", async () => {
    deps.validateSettings = vi.fn(async () => ({
      valid: false,
      error: "Invalid API key",
    }));
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-bad";
    validateButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.validateSettings).toHaveBeenCalledWith({
      apiKey: "sk-bad",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(status.textContent).toBe("Invalid API key");
    expect(status.dataset.variant).toBe("error");
    expect(Zotero.alert as any).toHaveBeenCalledWith(
      expect.anything(),
      "Deepseek Copliot Validation Failed",
      "Invalid API key",
    );
  });

  it("shows a validating status before reporting validation success", async () => {
    let resolveValidation:
      | ((value: { valid: boolean; error?: string }) => void)
      | null = null;
    deps.validateSettings = vi.fn(
      () =>
        new Promise<{ valid: boolean; error?: string }>((resolve) => {
          resolveValidation = resolve;
        }),
    );
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-validating";
    validateButton.dispatch("command");
    await Promise.resolve();

    expect(status.dataset.variant).toBe("success");
    expect(status.textContent).toBe("Validating connection...");

    if (!resolveValidation) {
      throw new Error("Expected validation promise resolver to be captured");
    }
    const finishValidation: (value: {
      valid: boolean;
      error?: string;
    }) => void = resolveValidation;
    finishValidation({ valid: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toBe("DeepSeek connection looks good");
    expect(status.dataset.variant).toBe("success");
    expect(Zotero.alert as any).toHaveBeenCalledWith(
      expect.anything(),
      "Deepseek Copliot",
      "DeepSeek connection looks good",
    );
  });

  it("uses zh-CN validation copy when Zotero is running in Chinese", async () => {
    (Zotero.Prefs.get as any).mockImplementation((key: string) =>
      key === "intl.locale.requested" ? "zh-CN" : "",
    );
    registerPreferencesPane(createWindow(), deps);

    validateButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toBe("DeepSeek 连接正常");
    expect(Zotero.alert as any).toHaveBeenCalledWith(
      expect.anything(),
      "Deepseek Copliot",
      "DeepSeek 连接正常",
    );
  });

  it("persists settings from XUL command events and broadcasts the change", () => {
    const eventSpy = vi.fn();
    EventBus.getInstance().addEventListener("settingsChange", eventSpy);
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-command";
    saveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-command",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it("responds to click events from preference buttons in the live Zotero pane", async () => {
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-click";
    saveButton.dispatch("click");
    validateButton.dispatch("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-click",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(deps.validateSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-click",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
  });

  it("exports the structured debug log from the preferences pane", async () => {
    vi.stubGlobal("PathUtils", { tempDir: "/tmp" });
    registerPreferencesPane(createWindow(), deps);
    debugLog.info("settings.test-marker", { surface: "settings" });

    exportDebugLogButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.exportDebugLog).toHaveBeenCalledWith(
      expect.stringMatching(/deepseek-copliot-debug-\d+\.jsonl$/),
    );
    expect(status.dataset.variant).toBe("success");
    expect(status.textContent).toContain("Debug log exported to");
  });

  it("reports debug log export failures inline", async () => {
    vi.stubGlobal("PathUtils", { tempDir: "/tmp" });
    deps.exportDebugLog = vi.fn(async () => {
      throw new Error("no writable path");
    });
    registerPreferencesPane(createWindow(), deps);

    exportDebugLogButton.dispatch("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(status.dataset.variant).toBe("error");
    expect(status.textContent).toBe("Debug log export failed: no writable path");
  });

  it("rebinds listeners when Zotero recreates the field nodes under the same root", () => {
    const win = createWindow();
    registerPreferencesPane(win, deps);

    const replacementApiKeyField = new FakeField();
    const replacementSaveButton = new FakeButton();
    const replacementValidateButton = new FakeButton();
    const replacementExportDebugLogButton = new FakeButton();
    const replacementStatus = new FakeStatusElement();
    const replacementCustomPresetsField = new FakeField();
    const replacementCustomPresetsEditor = new FakeField();
    const replacementCustomPresetsAddButton = new FakeButton();
    const replacementCustomPresetsResetButton = new FakeButton();
    const replacementCustomPresetsImportEditor = new FakeField();
    const replacementCustomPresetsImportPreview = new FakeField();
    const replacementCustomPresetsValidateImportButton = new FakeButton();
    const replacementCustomPresetsApplyImportButton = new FakeButton();
    const replacementCustomPresetsCopyAiPromptButton = new FakeButton();
    const replacementCustomPresetsDocsLink = new FakeLink();
    const replacementCustomPresetsStatus = new FakeStatusElement();
    const replacementEvidenceProviderField = new FakeField();
    const replacementTavilyApiKeyField = new FakeField();
    const replacementTavilyValidateButton = new FakeButton();
    const replacementTavilyStatus = new FakeStatusElement();
    const replacementTavilySettingsRow = new FakeField();
    const replacementDeepSeekLink = new FakeLink();
    const replacementTavilyLink = new FakeLink();
    const replacementDocument = new FakeDocument({
      "zotero-ai-assistant-prefs": root,
      "zotero-ai-assistant-pref-api-key": replacementApiKeyField,
      "zotero-ai-assistant-pref-save": replacementSaveButton,
      "zotero-ai-assistant-pref-validate": replacementValidateButton,
      "zotero-ai-assistant-pref-export-debug-log":
        replacementExportDebugLogButton,
      "zotero-ai-assistant-pref-status": replacementStatus,
      "zotero-ai-assistant-pref-custom-presets": replacementCustomPresetsField,
      "zotero-ai-assistant-pref-custom-presets-editor":
        replacementCustomPresetsEditor,
      "zotero-ai-assistant-pref-custom-presets-add":
        replacementCustomPresetsAddButton,
      "zotero-ai-assistant-pref-custom-presets-reset":
        replacementCustomPresetsResetButton,
      "zotero-ai-assistant-pref-custom-presets-import-editor":
        replacementCustomPresetsImportEditor,
      "zotero-ai-assistant-pref-custom-presets-import-preview":
        replacementCustomPresetsImportPreview,
      "zotero-ai-assistant-pref-custom-presets-validate-import":
        replacementCustomPresetsValidateImportButton,
      "zotero-ai-assistant-pref-custom-presets-apply-import":
        replacementCustomPresetsApplyImportButton,
      "zotero-ai-assistant-pref-custom-presets-copy-ai-prompt":
        replacementCustomPresetsCopyAiPromptButton,
      "zotero-ai-assistant-pref-custom-presets-docs-link":
        replacementCustomPresetsDocsLink,
      "zotero-ai-assistant-pref-custom-presets-status":
        replacementCustomPresetsStatus,
      "zotero-ai-assistant-pref-evidence-provider":
        replacementEvidenceProviderField,
      "zotero-ai-assistant-pref-tavily-api-key": replacementTavilyApiKeyField,
      "zotero-ai-assistant-pref-tavily-validate":
        replacementTavilyValidateButton,
      "zotero-ai-assistant-pref-tavily-status": replacementTavilyStatus,
      "zotero-ai-assistant-pref-tavily-settings": replacementTavilySettingsRow,
      "zotero-ai-assistant-pref-api-key-link": replacementDeepSeekLink,
      "zotero-ai-assistant-pref-tavily-link": replacementTavilyLink,
    });

    registerPreferencesPane(
      new FakeWindow(
        replacementDocument as unknown as FakeDocument,
      ) as unknown as Window,
      deps,
    );

    replacementApiKeyField.value = "sk-recreated";
    replacementSaveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-recreated",
      customPresets: "",
      evidenceProviderMode: "mcp-web-search",
      tavilyApiKey: "",
    });
    expect(replacementSaveButton.getListenerCount("command")).toBe(1);
    expect(replacementExportDebugLogButton.getListenerCount("command")).toBe(1);
    expect(replacementCustomPresetsAddButton.getListenerCount("command")).toBe(
      1,
    );
    expect(
      replacementCustomPresetsValidateImportButton.getListenerCount("command"),
    ).toBe(1);
    expect(replacementCustomPresetsDocsLink.getListenerCount("click")).toBe(1);
    expect(replacementDeepSeekLink.getListenerCount("click")).toBe(1);
    expect(replacementTavilyLink.getListenerCount("click")).toBe(1);
  });

  it("shows the Tavily settings only when the Tavily provider is selected", async () => {
    registerPreferencesPane(createWindow(), deps);

    expect(tavilySettingsRow.style.display).toBe("none");

    evidenceProviderField.value = "tavily";
    evidenceProviderField.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(tavilySettingsRow.style.display).toBe("");
    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-test",
      customPresets: "",
      evidenceProviderMode: "tavily",
      tavilyApiKey: "",
    });
  });

  it("validates Tavily settings with unsaved values", async () => {
    registerPreferencesPane(createWindow(), deps);

    evidenceProviderField.value = "tavily";
    evidenceProviderField.dispatch("command");
    tavilyApiKeyField.value = "tvly-next";
    tavilyValidateButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.validateEvidenceSettings).toHaveBeenCalledWith({
      apiKey: "sk-test",
      customPresets: "",
      evidenceProviderMode: "tavily",
      tavilyApiKey: "tvly-next",
    });
    expect(tavilyStatus.textContent).toBe("Tavily connection looks good");
  });

  it("reacts to radiogroup command events from the live preferences pane", async () => {
    registerPreferencesPane(createWindow(), deps);

    evidenceProviderField.value = "tavily";
    evidenceProviderField.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(tavilySettingsRow.style.display).toBe("");
    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-test",
      customPresets: "",
      evidenceProviderMode: "tavily",
      tavilyApiKey: "",
    });
  });
});
