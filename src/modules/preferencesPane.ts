import {
  DEFAULT_EVIDENCE_PROVIDER_MODE,
  type PersistedSettings,
  getSettings,
  saveSettings,
  validateEvidenceSettings,
  validateSettings,
} from "../services/settingsManager";
import { EventBus } from "../utils/eventBus";
import { isChineseLocale } from "../utils/locale";

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
const SAVE_BUTTON_ID = "zotero-ai-assistant-pref-save";
const VALIDATE_BUTTON_ID = "zotero-ai-assistant-pref-validate";
const STATUS_ID = "zotero-ai-assistant-pref-status";
const EVIDENCE_PROVIDER_ID = "zotero-ai-assistant-pref-evidence-provider";
const TAVILY_API_KEY_ID = "zotero-ai-assistant-pref-tavily-api-key";
const TAVILY_VALIDATE_BUTTON_ID = "zotero-ai-assistant-pref-tavily-validate";
const TAVILY_STATUS_ID = "zotero-ai-assistant-pref-tavily-status";
const TAVILY_SETTINGS_ID = "zotero-ai-assistant-pref-tavily-settings";

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
    const values = readFormValues(doc);
    deps.saveSettings(values);
    applyEvidenceProviderVisibility(doc, values.evidenceProviderMode);
    EventBus.getInstance().dispatchEvent(new Event("settingsChange"));
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
        zh ? "DS Copilot" : "DS Copilot",
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
      zh ? "DS Copilot 验证失败" : "DS Copilot Validation Failed",
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
  bindTriggeredFieldEvents(doc, EVIDENCE_PROVIDER_ID, ["change", "command"], persist);
  bindFieldEvent(doc, TAVILY_API_KEY_ID, "change", persist);
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
  const evidenceProviderField = getField(doc, EVIDENCE_PROVIDER_ID);
  const tavilyApiKeyField = getField(doc, TAVILY_API_KEY_ID);

  if (apiKeyField) {
    apiKeyField.value = settings.apiKey;
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
  const evidenceProviderField = getField(doc, EVIDENCE_PROVIDER_ID);
  const tavilyApiKeyField = getField(doc, TAVILY_API_KEY_ID);

  return {
    apiKey: apiKeyField?.value?.trim?.() ?? "",
    evidenceProviderMode:
      evidenceProviderField?.value === "tavily"
        ? "tavily"
        : DEFAULT_EVIDENCE_PROVIDER_MODE,
    tavilyApiKey: tavilyApiKeyField?.value?.trim?.() ?? "",
  };
}

function applyEvidenceProviderVisibility(
  doc: PreferencesDocument,
  providerMode: Partial<PersistedSettings>["evidenceProviderMode"] =
    DEFAULT_EVIDENCE_PROVIDER_MODE,
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
): (PreferencesFieldElement & {
  removeEventListener?(type: string, listener: (...args: any[]) => void): void;
  addEventListener(type: string, listener: (...args: any[]) => void): void;
}) | null {
  return doc.getElementById(id) as any;
}

function bindFieldEvent(
  doc: PreferencesDocument,
  id: string,
  type: string,
  listener: () => void,
): void {
  const field = getField(doc, id);
  if (!field) {
    return;
  }

  const listeners = field.__aiAssistantListeners ?? new Map<string, EventListener>();
  const previous = listeners.get(type);
  if (previous && typeof field.removeEventListener === "function") {
    field.removeEventListener(type, previous);
  }

  const eventListener = (() => listener()) as EventListener;
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
  const field = getField(doc, id);
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

  const listeners = field.__aiAssistantListeners ?? new Map<string, EventListener>();
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

function getStatusElement(doc: PreferencesDocument): PreferencesStatusElement | null {
  return doc.getElementById(STATUS_ID) as PreferencesStatusElement | null;
}

function getEvidenceStatusElement(
  doc: PreferencesDocument,
): PreferencesStatusElement | null {
  return doc.getElementById(TAVILY_STATUS_ID) as PreferencesStatusElement | null;
}

function showValidationDialog(win: Window, title: string, message: string): void {
  try {
    Zotero.alert(win, title, message);
  } catch (error) {
    ztoolkit.log("Failed to show validation dialog:", error);
  }
}
