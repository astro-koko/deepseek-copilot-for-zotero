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
  let saveButton: FakeButton;
  let validateButton: FakeButton;
  let status: FakeStatusElement;
  let deps: PreferencesPaneDeps;

  beforeEach(() => {
    EventBus.dispose();
    vi.stubGlobal("Zotero", {
      alert: vi.fn(),
    });
    root = new FakeRootElement();
    apiKeyField = new FakeField();
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

    apiKeyField.dispatch("change");
    await Promise.resolve();
    await Promise.resolve();

    expect(deps.saveSettings).toHaveBeenCalledWith({
      apiKey: "sk-next",
    });
    expect(status.textContent).toBe("l10n:ai-assistant-pref-status-saved");
    expect(status.dataset.variant).toBe("success");
  });

  it("persists only the API key even if internal defaults remain elsewhere", () => {
    registerPreferencesPane(createWindow(), deps);

    apiKeyField.value = "sk-internal-defaults";
    saveButton.dispatch("command");

    expect(deps.saveSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-internal-defaults",
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
    });
    expect(status.textContent).toBe("Invalid API key");
    expect(status.dataset.variant).toBe("error");
    expect((Zotero.alert as any)).toHaveBeenCalledWith(
      expect.anything(),
      "DS Copilot Validation Failed",
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
    const finishValidation: (value: { valid: boolean; error?: string }) => void =
      resolveValidation;
    finishValidation({ valid: true });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toBe("DeepSeek connection looks good");
    expect(status.dataset.variant).toBe("success");
    expect((Zotero.alert as any)).toHaveBeenCalledWith(
      expect.anything(),
      "DS Copilot",
      "DeepSeek connection looks good",
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
    });
    expect(deps.validateSettings).toHaveBeenLastCalledWith({
      apiKey: "sk-click",
    });
  });

  it("rebinds listeners when Zotero recreates the field nodes under the same root", () => {
    const win = createWindow();
    registerPreferencesPane(win, deps);

    const replacementApiKeyField = new FakeField();
    const replacementSaveButton = new FakeButton();
    const replacementValidateButton = new FakeButton();
    const replacementStatus = new FakeStatusElement();
    const replacementDocument = new FakeDocument({
      "zotero-ai-assistant-prefs": root,
      "zotero-ai-assistant-pref-api-key": replacementApiKeyField,
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
    });
    expect(replacementSaveButton.getListenerCount("command")).toBe(1);
  });
});
