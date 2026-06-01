import {
  type PersistedSettings,
  getSettings,
  saveSettings,
  validateSettings,
} from "../services/settingsManager";
import { EventBus } from "../utils/eventBus";

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
}

const ROOT_ID = "zotero-ai-assistant-prefs";
const API_KEY_ID = "zotero-ai-assistant-pref-api-key";
const SAVE_BUTTON_ID = "zotero-ai-assistant-pref-save";
const VALIDATE_BUTTON_ID = "zotero-ai-assistant-pref-validate";
const STATUS_ID = "zotero-ai-assistant-pref-status";

export function registerPreferencesPane(
  win: Window,
  deps: PreferencesPaneDeps = {
    getSettings,
    saveSettings,
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
    const result = await deps.validateSettings(values);
    if (result.valid) {
      await updateStatus(doc, "ai-assistant-pref-status-valid", "success");
      return;
    }

    setStatusText(doc, result.error || "Validation failed", "error");
  };

  bindFieldEvent(doc, API_KEY_ID, "change", persist);
  bindFieldEvent(doc, SAVE_BUTTON_ID, "command", persist);
  bindFieldEvent(doc, VALIDATE_BUTTON_ID, "command", () => {
    void validate();
  });
}

function hydrateForm(
  doc: PreferencesDocument,
  settings: ReturnType<typeof getSettings>,
): void {
  const apiKeyField = getField(doc, API_KEY_ID);

  if (apiKeyField) {
    apiKeyField.value = settings.apiKey;
  }
}

function readFormValues(doc: PreferencesDocument): Partial<PersistedSettings> {
  const apiKeyField = getField(doc, API_KEY_ID);

  return {
    apiKey: apiKeyField?.value?.trim?.() ?? "",
  };
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

async function updateStatus(
  doc: PreferencesDocument,
  l10nId: string,
  variant: "success" | "error",
): Promise<void> {
  const status = doc.getElementById(STATUS_ID) as PreferencesStatusElement | null;
  if (!status) {
    return;
  }

  status.dataset.variant = variant;

  const formatter = doc.l10n?.formatValue;
  if (!formatter) {
    status.textContent = l10nId;
    return;
  }

  const value = await formatter(l10nId);
  status.textContent = String(value);
}

function setStatusText(
  doc: PreferencesDocument,
  value: string,
  variant: "success" | "error",
): void {
  const status = getStatusElement(doc);
  if (!status) {
    return;
  }

  status.dataset.variant = variant;
  status.textContent = value;
}

function getStatusElement(doc: PreferencesDocument): PreferencesStatusElement | null {
  return doc.getElementById(STATUS_ID) as PreferencesStatusElement | null;
}
