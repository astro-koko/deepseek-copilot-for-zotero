import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerPreferencesPane,
  type PreferencesPaneDeps,
} from "./preferencesPane";
import { EventBus } from "../utils/eventBus";

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

  dispatch(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener({ type }));
  }

  getListenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeField extends FakeEventTarget {
  value = "";
  disabled = false;
}

class FakeButton extends FakeField {}

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

  constructor(
    private readonly elements: Record<string, unknown>,
  ) {}

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
  let modelField: FakeField;
  let maxContextField: FakeField;
  let saveButton: FakeButton;
  let validateButton: FakeButton;
  let status: FakeStatusElement;
  let deps: PreferencesPaneDeps;

  beforeEach(() => {
    EventBus.dispose();
    root = new FakeRootElement();
    apiKeyField = new FakeField();
    modelField = new FakeField();
    maxContextField = new FakeField();
    saveButton = new FakeButton();
    validateButton = new FakeButton();
    status = new FakeStatusElement();

    deps = {
      getSettings: vi.fn(() => ({
        apiKey: "sk-test",
        baseURL: "https://api.deepseek.com",
        model: "deepseek-v4-pro",
        maxContextBudget: 8192,
        keyboardShortcut: "I",
      })),
      saveSettings: vi.fn(),
      validateSettings: vi.fn(async () => ({ valid: true })),
    };
  });

  function createWindow() {
    const document = new FakeDocument({
      "zotero-ai-assistant-prefs": root,
      "zotero-ai-assistant-pref-api-key": apiKeyField,
      "zotero-ai-assistant-pref-model": modelField,
      "zotero-ai-assistant-pref-max-context": maxContextField,
      "zotero-ai-assistant-pref-save": saveButton,
      "zotero-ai-assistant-pref-validate": validateButton,
      "zotero-ai-assistant-pref-status": status,
    });

    return new FakeWindow(document as unknown as FakeDocument) as unknown as Window;
  }

  it("hydrates field values from settings on load", () => {
    registerPreferencesPane(createWindow(), deps);

    expect(deps.getSettings).toHaveBeenCalledTimes(1);
    expect(apiKeyField.value).toBe("sk-test");
    expect(modelField.value).toBe("deepseek-v4-pro");
    expect(maxContextField.value).toBe("8192");
  });

  it("binds listeners only once when the pane is reopened", () => {
    const win = createWindow();

    registerPreferencesPane(win, deps);
    apiKeyField.value = "sk-updated";
    registerPreferencesPane(win, deps);
    apiKeyField.dispatch("change");

    expect(apiKeyField.getListenerCount("change")).toBe(1);
    expect(saveButton.getListenerCount("command")).toBe(1);
    expect(validateButton.getListenerCount("command")).toBe(1);
    expect(deps.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("saves normalized values on change and reports success", async () => {
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-next";
    modelField.value = "deepseek-v4-flash";
    maxContextField.value = "12000";

    apiKeyField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).toHaveBeenCalledWith({
      apiKey: "sk-next",
      model: "deepseek-v4-flash",
      maxContextBudget: 12000,
    });
    expect(status.textContent).toBe("l10n:ai-assistant-pref-status-saved");
    expect(status.dataset.variant).toBe("success");
  });

  it("falls back to the default max context budget when the form value is invalid", () => {
    registerPreferencesPane(createWindow(), deps);

    maxContextField.value = "not-a-number";
    saveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-test",
      model: "deepseek-v4-pro",
      maxContextBudget: 4000,
    });
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
      model: "deepseek-v4-pro",
      maxContextBudget: 8192,
    });
    expect(status.textContent).toBe("Invalid API key");
    expect(status.dataset.variant).toBe("error");
  });

  it("persists settings from XUL command events and broadcasts the change", () => {
    const eventSpy = vi.fn();
    EventBus.getInstance().addEventListener("settingsChange", eventSpy);
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-command";
    saveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-command",
      model: "deepseek-v4-pro",
      maxContextBudget: 8192,
    });
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it("rebinds listeners when Zotero recreates the field nodes under the same root", () => {
    const win = createWindow();
    registerPreferencesPane(win, deps);

    const replacementApiKeyField = new FakeField();
    const replacementModelField = new FakeField();
    const replacementMaxContextField = new FakeField();
    const replacementSaveButton = new FakeButton();
    const replacementValidateButton = new FakeButton();
    const replacementStatus = new FakeStatusElement();
    const replacementDocument = new FakeDocument({
      "zotero-ai-assistant-prefs": root,
      "zotero-ai-assistant-pref-api-key": replacementApiKeyField,
      "zotero-ai-assistant-pref-model": replacementModelField,
      "zotero-ai-assistant-pref-max-context": replacementMaxContextField,
      "zotero-ai-assistant-pref-save": replacementSaveButton,
      "zotero-ai-assistant-pref-validate": replacementValidateButton,
      "zotero-ai-assistant-pref-status": replacementStatus,
    });

    registerPreferencesPane(
      new FakeWindow(replacementDocument as unknown as FakeDocument) as unknown as Window,
      deps,
    );

    replacementApiKeyField.value = "sk-recreated";
    replacementSaveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-recreated",
      model: "deepseek-v4-pro",
      maxContextBudget: 8192,
    });
    expect(replacementSaveButton.getListenerCount("command")).toBe(1);
  });
});
