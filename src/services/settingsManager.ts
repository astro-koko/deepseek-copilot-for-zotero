import { getPref, setPref } from "../utils/prefs";
import { config } from "../../package.json";

export interface PersistedSettings {
  apiKey: string;
  model: string;
  maxContextBudget: number;
  keyboardShortcut: string;
}

export interface Settings extends PersistedSettings {
  baseURL: string;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"] as const;

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  baseURL: DEEPSEEK_BASE_URL,
  model: DEEPSEEK_MODELS[0],
  maxContextBudget: 4000,
  keyboardShortcut: "I",
};

export const PREFERENCES_PANE_ID = `${config.addonRef}-prefpane`;

function normalizeModel(model: string | undefined): string {
  const value = model?.trim();
  if (value && DEEPSEEK_MODELS.includes(value as (typeof DEEPSEEK_MODELS)[number])) {
    return value;
  }

  return DEFAULT_SETTINGS.model;
}

export function getSettings(): Settings {
  return {
    apiKey: (getPref("apiKey") || "") as string,
    baseURL: DEEPSEEK_BASE_URL,
    model: normalizeModel(getPref("model") as string | undefined),
    maxContextBudget: Number(
      getPref("maxContextBudget") || DEFAULT_SETTINGS.maxContextBudget,
    ),
    keyboardShortcut: (getPref("keyboardShortcut") || DEFAULT_SETTINGS.keyboardShortcut) as string,
  };
}

export function saveSettings(settings: Partial<PersistedSettings>): void {
  if (settings.apiKey !== undefined) setPref("apiKey", settings.apiKey);
  if (settings.model !== undefined) setPref("model", normalizeModel(settings.model));
  if (settings.maxContextBudget !== undefined)
    setPref("maxContextBudget", settings.maxContextBudget);
  if (settings.keyboardShortcut !== undefined)
    setPref("keyboardShortcut", settings.keyboardShortcut);
}

export function getSettingsIssue(settings: Settings = getSettings()): string | null {
  if (!settings.apiKey.trim()) {
    return "DeepSeek API key not configured. Open plugin Settings to continue.";
  }

  return null;
}

function mergeSettings(overrides?: Partial<Settings>): Settings {
  const settings = getSettings();
  if (!overrides) return settings;

  return {
    ...settings,
    ...overrides,
    baseURL: DEEPSEEK_BASE_URL,
    model: normalizeModel(overrides.model ?? settings.model),
  };
}

export async function validateSettings(
  overrides?: Partial<Settings>,
): Promise<{
  valid: boolean;
  error?: string;
}> {
  const settings = mergeSettings(overrides);

  if (!settings.apiKey.trim()) {
    return { valid: false, error: "API key is required" };
  }

  if (!settings.baseURL) {
    return { valid: false, error: "Base URL is required" };
  }

  try {
    const response = await fetch(`${settings.baseURL}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: false, error: `Provider error: ${response.status}` };
    }

    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: `Connection failed: ${e.message}` };
  }
}
