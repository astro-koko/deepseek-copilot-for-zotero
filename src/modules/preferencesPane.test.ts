import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCustomSlashCard,
  commitSlashCardEdit,
  createSlashSettingsState,
  registerPreferencesPane,
  restoreBuiltInSlashCard,
  serializeSlashSettingsState,
  validateSlashCardDraft,
  type PreferencesPaneDeps,
} from "./preferencesPane";
import { EventBus } from "../utils/eventBus";
import { getSidebarPresetsForScope } from "../services/presets";

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
  textContent = "";
  style = { display: "" };
  children: FakeField[] = [];
  attributes: Record<string, string> = {};

  setAttribute(name: string, value: string) {
    if (name === "disabled") {
      this.disabled = true;
    }
    this.attributes[name] = value;
    (this as unknown as Record<string, string>)[name] = value;
  }

  removeAttribute(name: string) {
    if (name === "disabled") {
      this.disabled = false;
    }
    delete this.attributes[name];
    delete (this as unknown as Record<string, string>)[name];
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  appendChild(child: FakeField) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: FakeField[]) {
    this.children = [...nodes];
  }

  querySelectorAll(selector: string) {
    const results: FakeField[] = [];
    const attrMatch = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    const walk = (node: FakeField) => {
      if (attrMatch) {
        const [, attr, expected] = attrMatch;
        const actual = node.getAttribute(attr);
        if (actual !== null && (expected === undefined || actual === expected)) {
          results.push(node);
        }
      }
      node.children.forEach(walk);
    };
    this.children.forEach(walk);
    return results as unknown as NodeListOf<Element>;
  }

  querySelector(selector: string) {
    return (this.querySelectorAll(selector)[0] as Element | undefined) ?? null;
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

class FakeContainer {
  innerHTML = "";
  children: FakeField[] = [];
  textContent = "";

  appendChild(child: FakeField) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: FakeField[]) {
    this.children = [...nodes];
  }

  querySelectorAll(selector: string) {
    const root = new FakeField();
    root.children = this.children;
    return root.querySelectorAll(selector);
  }

  querySelector(selector: string) {
    return (this.querySelectorAll(selector)[0] as Element | undefined) ?? null;
  }
}

class FakeDocument {
  l10n = {
    formatValue: vi.fn(async (id: string) => `l10n:${id}`),
  };

  constructor(private readonly elements: Record<string, unknown>) {}

  getElementById(id: string) {
    return (this.elements[id] as HTMLElement | null) ?? null;
  }

  createElementNS(_namespace: string, tag: string) {
    const field = new FakeField();
    field.setAttribute("data-tag", tag);
    return field as unknown as HTMLElement;
  }
}

class FakeWindow {
  constructor(public document: FakeDocument) {}
}

describe("slash settings state", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates built-in cards with Chinese-first slash defaults in zh locales", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) =>
          key === "intl.locale.requested" ? "zh-CN" : "",
        ),
      },
    });

    const state = createSlashSettingsState("");
    const summarize = state.builtins.find((card) => card.id === "summarize");

    expect(summarize).toMatchObject({
      title: "总结论文",
    });
    expect(summarize?.slashCommand).toBe("总结论文");
  });

  it("keeps custom commands separate from built-ins", () => {
    const state = createSlashSettingsState(
      JSON.stringify([
        {
          id: "summarize",
          label: "总结实验",
          promptPrefix: "重点总结实验设计和结果",
          slashCommand: "总结实验",
        },
        {
          id: "future-work",
          label: "未来工作",
          promptPrefix: "提出三个下一步研究方向",
          slashCommand: "未来工作",
        },
      ]),
    );

    expect(state.builtins.find((card) => card.id === "summarize")).toMatchObject(
      {
        title: "总结实验",
      },
    );
    expect(state.custom).toHaveLength(1);
    expect(state.custom[0]).toMatchObject({
      id: "future-work",
      title: "未来工作",
    });
    expect(state.custom[0]?.slashCommand).toBe("未来工作");
  });

  it("serializes only built-in overrides and custom cards", () => {
    const state = createSlashSettingsState("");
    const editedState = {
      ...state,
      builtins: state.builtins.map((card) =>
        card.id === "summarize"
          ? { ...card, title: "总结实验", slashCommand: "总结实验" }
          : card,
      ),
      custom: [
        {
          id: "future-work",
          isNew: false,
          kind: "custom" as const,
          promptPrefix: "提出三个下一步研究方向",
          slashCommand: "未来工作",
          title: "未来工作",
        },
      ],
    };

    const serialized = serializeSlashSettingsState(editedState);

    expect(serialized).toContain('"id": "summarize"');
    expect(serialized).toContain('"id": "future-work"');
    expect(serialized).not.toContain('"id": "explain"');
  });

  it("adds custom cards until the configured cap", () => {
    let state = createSlashSettingsState("");
    for (let index = 0; index < 12; index += 1) {
      state = addCustomSlashCard(state);
    }

    expect(state.custom).toHaveLength(10);
    expect(state.custom.every((card) => card.kind === "custom")).toBe(true);
  });

  it("validates duplicate titles across built-in and custom cards", () => {
    const state = createSlashSettingsState("");
    const duplicate = validateSlashCardDraft(state, {
      id: "future-work",
      kind: "custom",
      promptPrefix: "提出下一步研究方向",
      slashCommand: "Summarize",
      title: "Summarize",
    });

    expect(duplicate).toBe("This title is already in use");
  });

  it("discards a blank new custom card when the user blurs away", () => {
    let state = addCustomSlashCard(createSlashSettingsState(""));
    const blankId = state.custom[0]?.id;
    if (!blankId) {
      throw new Error("Expected a blank custom card");
    }

    const result = commitSlashCardEdit(
      state,
      { id: blankId, kind: "custom" },
      {
        promptPrefix: "",
        slashCommand: "",
        title: "",
      },
    );

    expect(result.saved).toBe(false);
    expect(result.state.custom).toHaveLength(0);
  });

  it("derives slash commands from the edited title", () => {
    let state = addCustomSlashCard(createSlashSettingsState(""));
    const cardId = state.custom[0]?.id;
    if (!cardId) {
      throw new Error("Expected a blank custom card");
    }

    const result = commitSlashCardEdit(
      state,
      { id: cardId, kind: "custom" },
      {
        promptPrefix: "提出三个下一步研究方向",
        title: "未来工作",
      },
    );

    expect(result.saved).toBe(true);
    expect(result.state.custom[0]?.slashCommand).toBe("未来工作");
    expect(serializeSlashSettingsState(result.state)).toContain(
      '"slashCommand": "未来工作"',
    );
  });

  it("restores edited built-ins back to code-defined defaults", () => {
    const state = createSlashSettingsState(
      JSON.stringify([
        {
          id: "summarize",
          label: "总结实验",
          promptPrefix: "重点总结实验设计和结果",
          slashCommand: "总结实验",
        },
      ]),
    );

    const restored = restoreBuiltInSlashCard(state, "summarize");
    const summarize = restored.builtins.find((card) => card.id === "summarize");

    expect(summarize?.title).not.toBe("总结实验");
    expect(serializeSlashSettingsState(restored)).toBe("");
  });

  it("saves valid built-in edits as overrides", () => {
    const state = createSlashSettingsState("");
    const result = commitSlashCardEdit(
      state,
      { id: "summarize", kind: "builtin" },
      {
        promptPrefix: "Focus on experiments and results.",
        title: "Summary Lite",
      },
    );

    expect(result.saved).toBe(true);
    expect(serializeSlashSettingsState(result.state)).toContain(
      '"id": "summarize"',
    );
    expect(result.state.builtins.find((card) => card.id === "summarize")?.slashCommand).toBe(
      "Summary Lite",
    );
  });

  it("keeps sidebar recommendations fixed even when slash state serializes custom cards", () => {
    let state = createSlashSettingsState("");
    state = addCustomSlashCard(state);
    const cardId = state.custom[0]?.id;
    if (!cardId) {
      throw new Error("Expected a custom card");
    }

    const committed = commitSlashCardEdit(
      state,
      { id: cardId, kind: "custom" },
      {
        promptPrefix: "Suggest three concrete next studies.",
        slashCommand: "future-work",
        title: "Future Work",
      },
    );

    const serialized = serializeSlashSettingsState(committed.state);
    expect(getSidebarPresetsForScope("paper", serialized).map((preset) => preset.id)).toEqual([
      "summarize",
      "core-contribution",
      "method",
      "limitations",
    ]);
  });
});

describe("registerPreferencesPane", () => {
  let root: FakeRootElement;
  let apiKeyField: FakeField;
  let saveButton: FakeButton;
  let validateButton: FakeButton;
  let exportDebugLogButton: FakeButton;
  let status: FakeStatusElement;
  let customPresetsField: FakeField;
  let slashBuiltins: FakeContainer;
  let slashCustom: FakeContainer;
  let slashAddButton: FakeButton;
  let slashLimitStatus: FakeStatusElement;
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
    slashBuiltins = new FakeContainer();
    slashCustom = new FakeContainer();
    slashAddButton = new FakeButton();
    slashLimitStatus = new FakeStatusElement();
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
      "zotero-ai-assistant-pref-slash-builtins": slashBuiltins,
      "zotero-ai-assistant-pref-slash-custom": slashCustom,
      "zotero-ai-assistant-pref-slash-add": slashAddButton,
      "zotero-ai-assistant-pref-slash-limit-status": slashLimitStatus,
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

  it("hydrates API, slash storage, and evidence provider values on load", () => {
    registerPreferencesPane(createWindow(), deps);

    expect(deps.getSettings).toHaveBeenCalledTimes(1);
    expect(apiKeyField.value).toBe("sk-test");
    expect(customPresetsField.value).toBe("");
    expect(evidenceProviderField.value).toBe("mcp-web-search");
    expect(slashBuiltins.querySelectorAll('[data-slash-card="true"]').length).toBeGreaterThan(0);
    expect(
      slashBuiltins.querySelector('[data-slash-field="title"]'),
    ).toBeTruthy();
    expect(
      slashBuiltins.querySelector('[data-slash-field="slashCommand"]'),
    ).toBeFalsy();
  });

  it("binds listeners only once when the pane is reopened", () => {
    const win = createWindow();
    registerPreferencesPane(win, deps);
    registerPreferencesPane(win, deps);

    apiKeyField.value = "sk-updated";
    apiKeyField.dispatch("change");

    expect(apiKeyField.getListenerCount("change")).toBe(1);
    expect(saveButton.getListenerCount("command")).toBe(1);
    expect(validateButton.getListenerCount("command")).toBe(1);
    expect(exportDebugLogButton.getListenerCount("command")).toBe(1);
    expect(evidenceProviderField.getListenerCount("change")).toBe(1);
    expect(evidenceProviderField.getListenerCount("command")).toBe(1);
    expect(tavilyValidateButton.getListenerCount("command")).toBe(1);
    expect(deps.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("opens the DeepSeek and Tavily signup links through Zotero.launchURL", () => {
    (Zotero as any).launchURL = vi.fn();
    registerPreferencesPane(createWindow(), deps);

    deepSeekLink.dispatch("click", { preventDefault: vi.fn() });
    tavilyLink.dispatch("click", { preventDefault: vi.fn() });

    expect((Zotero as any).launchURL).toHaveBeenNthCalledWith(
      1,
      "https://platform.deepseek.com/",
    );
    expect((Zotero as any).launchURL).toHaveBeenNthCalledWith(
      2,
      "https://app.tavily.com/",
    );
  });

  it("saves normalized values on API key change and reports success", async () => {
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

  it("shows slash limit help and keeps add enabled while under the cap", () => {
    registerPreferencesPane(createWindow(), deps);

    expect(slashLimitStatus.textContent).toBe(
      "You can add up to 10 custom commands",
    );
    expect(slashAddButton.disabled).toBe(false);
  });

  it("adds only one custom slash card when Zotero fires command then click", async () => {
    registerPreferencesPane(createWindow(), deps);

    slashAddButton.dispatch("command");
    slashAddButton.dispatch("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(slashCustom.querySelectorAll('[data-slash-card="true"]').length).toBe(1);
  });

  it("adds only one custom slash card when Zotero fires click after command on a later tick", async () => {
    registerPreferencesPane(createWindow(), deps);

    slashAddButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();
    slashAddButton.dispatch("click");
    await Promise.resolve();
    await Promise.resolve();

    expect(slashCustom.querySelectorAll('[data-slash-card="true"]').length).toBe(1);
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
  });

  it("exports the structured debug log from the preferences pane", async () => {
    vi.stubGlobal("PathUtils", { tempDir: "/tmp" });
    registerPreferencesPane(createWindow(), deps);

    exportDebugLogButton.dispatch("command");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.exportDebugLog).toHaveBeenCalledWith(
      expect.stringMatching(/deepseek-copliot-debug-\d+\.jsonl$/),
    );
    expect(status.dataset.variant).toBe("success");
    expect(status.textContent).toContain("Debug log exported to");
  });
});
