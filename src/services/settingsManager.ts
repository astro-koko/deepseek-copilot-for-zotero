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
  debugValidation("validateSettings:start", {
    hasApiKey: Boolean(settings.apiKey.trim()),
    model: settings.model,
  });

  if (!settings.apiKey.trim()) {
    return { valid: false, error: "API key is required" };
  }

  if (!settings.baseURL) {
    return { valid: false, error: "Base URL is required" };
  }

  try {
    const response = await sendValidationRequest(settings, 8000);
    debugValidation("validateSettings:response", response);

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      if (response.status === 402) {
        return { valid: false, error: "Insufficient DeepSeek balance" };
      }
      return { valid: false, error: `Provider error: ${response.status}` };
    }

    return { valid: true };
  } catch (e: any) {
    debugValidation("validateSettings:error", e);
    const status = Number(e?.status ?? e?.xhr?.status ?? 0);
    if (status === 401) {
      return { valid: false, error: "Invalid API key" };
    }
    if (status === 402) {
      return { valid: false, error: "Insufficient DeepSeek balance" };
    }
    return { valid: false, error: `Connection failed: ${e.message}` };
  }
}

async function sendValidationRequest(
  settings: Settings,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  status: number;
}> {
  const endpoint = `${settings.baseURL}/chat/completions`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${settings.apiKey}`,
  };
  const body = JSON.stringify({
    model: settings.model,
    messages: [{ role: "user", content: "ping" }],
    stream: false,
    max_tokens: 1,
    temperature: 0,
  });

  const hostHttp = (globalThis as any).Zotero?.HTTP as
    | {
        request?: (
          method: string,
          url: string,
        options: {
          body: string;
          headers: Record<string, string>;
          responseType: string;
          successCodes?: boolean;
          timeout?: number;
        },
      ) => Promise<{ responseText?: string; status?: number }>;
      }
    | undefined;

  if (typeof hostHttp?.request === "function") {
    debugValidation("validateSettings:hostHttp:request");
    const response = await runWithTimeout(
      () =>
        hostHttp.request!("POST", endpoint, {
          body,
          headers,
          responseType: "text",
          successCodes: false,
          timeout: timeoutMs,
        }),
      timeoutMs,
    );
    debugValidation("validateSettings:hostHttp:resolved", {
      status: response?.status,
      hasResponseText: Boolean(response?.responseText),
    });
    const status = Number(response?.status ?? 0);
    return {
      ok: status >= 200 && status < 300,
      status,
    };
  }

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers,
      body,
    },
    timeoutMs,
  );

  return {
    ok: response.ok,
    status: response.status,
  };
}

async function runWithTimeout<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const timers = resolveTimerHost();
  let timeoutId: unknown = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = timers.setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([factory(), timeoutPromise]);
  } finally {
    if (timeoutId != null) {
      timers.clearTimeout(timeoutId);
    }
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const AbortControllerCtor = (globalThis as any).AbortController;
  const controller =
    typeof AbortControllerCtor === "function"
      ? new AbortControllerCtor()
      : null;

  return runWithTimeout(
    () =>
      fetch(input, {
        ...init,
        signal: controller?.signal,
      }),
    timeoutMs,
  ).catch((error) => {
    if (String(error?.message || "").includes(`Timed out after ${timeoutMs}ms`)) {
      controller?.abort?.();
    }
    throw error;
  });
}

function resolveTimerHost(): {
  clearTimeout: (timerId: unknown) => void;
  setTimeout: (callback: () => void, timeoutMs: number) => unknown;
} {
  const globalSetTimeout = (globalThis as any).setTimeout;
  const globalClearTimeout = (globalThis as any).clearTimeout;

  if (
    typeof globalSetTimeout === "function" &&
    typeof globalClearTimeout === "function"
  ) {
    return {
      setTimeout: (callback, timeoutMs) => globalSetTimeout(callback, timeoutMs),
      clearTimeout: (timerId) => globalClearTimeout(timerId),
    };
  }

  const mainWindow = Zotero.getMainWindow?.() as
    | {
        clearTimeout?: (timerId: unknown) => void;
        setTimeout?: (callback: () => void, timeoutMs: number) => unknown;
      }
    | undefined;

  if (
    typeof mainWindow?.setTimeout === "function" &&
    typeof mainWindow?.clearTimeout === "function"
  ) {
    return {
      setTimeout: (callback, timeoutMs) => mainWindow.setTimeout?.(callback, timeoutMs),
      clearTimeout: (timerId) => mainWindow.clearTimeout?.(timerId),
    };
  }

  return {
    setTimeout: (callback, timeoutMs) => {
      callback();
      return timeoutMs;
    },
    clearTimeout: () => {},
  };
}

function debugValidation(message: string, payload?: unknown): void {
  const logger = (globalThis as any).ztoolkit?.log;
  if (typeof logger !== "function") {
    return;
  }

  try {
    logger(message, payload);
  } catch {
    // Ignore host logging failures during diagnostics.
  }
}
