import { getPref, setPref } from "../utils/prefs";

export interface Settings {
  apiKey: string;
  baseURL: string;
  model: string;
  maxContextBudget: number;
  keyboardShortcut: string;
}

export function getSettings(): Settings {
  return {
    apiKey: (getPref("apiKey") || "") as string,
    baseURL: (getPref("baseURL") || "https://api.openai.com/v1") as string,
    model: (getPref("model") || "gpt-4o-mini") as string,
    maxContextBudget: (getPref("maxContextBudget") || 4000) as number,
    keyboardShortcut: (getPref("keyboardShortcut") || "I") as string,
  };
}

export function saveSettings(settings: Partial<Settings>): void {
  if (settings.apiKey !== undefined) setPref("apiKey", settings.apiKey);
  if (settings.baseURL !== undefined) setPref("baseURL", settings.baseURL);
  if (settings.model !== undefined) setPref("model", settings.model);
  if (settings.maxContextBudget !== undefined)
    setPref("maxContextBudget", settings.maxContextBudget);
  if (settings.keyboardShortcut !== undefined)
    setPref("keyboardShortcut", settings.keyboardShortcut);
}

export async function validateSettings(): Promise<{
  valid: boolean;
  error?: string;
}> {
  const settings = getSettings();

  if (!settings.apiKey) {
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
