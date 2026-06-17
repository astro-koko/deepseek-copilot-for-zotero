import type { CommandPreset } from "./presets";
import { getPref, setPref } from "../utils/prefs";
import { config } from "../../package.json";
import type { ScopeType } from "../types/scope";

export const DEFAULT_EVIDENCE_PROVIDER_MODE = "mcp-web-search";
export type EvidenceProviderMode =
  | typeof DEFAULT_EVIDENCE_PROVIDER_MODE
  | "tavily";
type LegacyEvidenceProviderMode = "builtin-search";

export interface PersistedSettings {
  apiKey: string;
  customPresets: string;
  model: string;
  maxContextBudget: number;
  keyboardShortcut: string;
  evidenceEnabled: boolean;
  evidenceProviderMode: EvidenceProviderMode;
  tavilyApiKey: string;
}

export interface Settings extends PersistedSettings {
  baseURL: string;
}

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
] as const;
export const TAVILY_BASE_URL = "https://api.tavily.com";

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  baseURL: DEEPSEEK_BASE_URL,
  customPresets: "",
  model: DEEPSEEK_MODELS[0],
  maxContextBudget: 4000,
  keyboardShortcut: "I",
  evidenceEnabled: false,
  evidenceProviderMode: DEFAULT_EVIDENCE_PROVIDER_MODE,
  tavilyApiKey: "",
};

export const PREFERENCES_PANE_ID = `${config.addonRef}-prefpane`;

function normalizeModel(model: string | undefined): string {
  const value = model?.trim();
  if (
    value &&
    DEEPSEEK_MODELS.includes(value as (typeof DEEPSEEK_MODELS)[number])
  ) {
    return value;
  }

  return DEFAULT_SETTINGS.model;
}

function normalizeEvidenceProviderMode(
  mode: string | LegacyEvidenceProviderMode | undefined,
): EvidenceProviderMode {
  return mode === "tavily" ? "tavily" : DEFAULT_EVIDENCE_PROVIDER_MODE;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export type CustomCommandPreset = Partial<CommandPreset> & {
  hidden?: boolean;
  id?: string;
  mode?: "append" | "replace";
  slashCommand?: string;
  showInSidebar?: boolean;
};

export type ParsedCustomCommandPreset = CustomCommandPreset & {
  id: string;
};

export interface EditableCustomCommandPreset {
  aliasesText: string;
  description: string;
  enabled: boolean;
  evidenceHint: boolean;
  group: NonNullable<CommandPreset["group"]>;
  hidden?: boolean;
  id: string;
  label: string;
  promptPrefix: string;
  slashCommand: string;
  showInSidebar: boolean;
  scopeHint: ScopeType[];
}

export interface CustomPresetsParseResult {
  presets: ParsedCustomCommandPreset[];
  error: string | null;
}

function normalizeCustomPresetsValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function slugifyPresetId(value: string, index: number): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug || `custom-${index + 1}`;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,，\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function serializeStringArray(value: string[]): string {
  return value.map((item) => item.trim()).filter(Boolean).join(", ");
}

function normalizeScopeHints(value: unknown): CommandPreset["scopeHint"] {
  const validScopeTypes = new Set([
    "paper",
    "pdf",
    "collection",
    "manual-selection",
  ]);
  const scopes = normalizeStringArray(value).filter((scope) =>
    validScopeTypes.has(scope),
  ) as NonNullable<CommandPreset["scopeHint"]>;

  return scopes.length > 0 ? scopes : undefined;
}

function normalizePresetGroup(value: unknown): CommandPreset["group"] {
  return value === "analysis" || value === "evidence" || value === "reading"
    ? value
    : "reading";
}

export function parseCustomPresets(value: string): CustomPresetsParseResult {
  const normalized = normalizeCustomPresetsValue(value);
  if (!normalized) {
    return { presets: [], error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    return {
      presets: [],
      error:
        error instanceof Error && error.message
          ? `Invalid custom suggestions JSON: ${error.message}`
          : "Invalid custom suggestions JSON",
    };
  }

  const rawPresets = Array.isArray(parsed) ? parsed : [parsed];
  const presets: ParsedCustomCommandPreset[] = [];
  const usedIds = new Set<string>();
  for (const [index, rawPreset] of rawPresets.entries()) {
    if (!rawPreset || typeof rawPreset !== "object") {
      continue;
    }

    const source = rawPreset as Record<string, unknown>;
    const rawId = String(source.id || "").trim();
    const label = String(source.label || "").trim();
    const promptPrefix = String(
      source.promptPrefix || source.prompt || "",
    ).trim();
    const slashCommand = String(
      source.slashCommand || source.command || rawId || "",
    ).trim();
    if (!rawId && !label) {
      continue;
    }

    let id = slugifyPresetId(rawId || label, index);
    while (usedIds.has(id)) {
      id = `${id}-${index + 1}`;
    }
    usedIds.add(id);

    const preset: ParsedCustomCommandPreset = {
      id,
      mode: source.mode === "replace" ? "replace" : "append",
    };
    if (source.aliases !== undefined) {
      preset.aliases = normalizeStringArray(source.aliases);
    }
    if (source.description !== undefined) {
      preset.description = String(source.description || "").trim();
    }
    if (source.evidenceHint !== undefined) {
      preset.evidenceHint = normalizeBoolean(source.evidenceHint);
    }
    if (source.group !== undefined) {
      preset.group = normalizePresetGroup(source.group);
    }
    if (label) {
      preset.label = label;
    }
    if (promptPrefix) {
      preset.promptPrefix = promptPrefix;
    }
    if (slashCommand) {
      preset.slashCommand = slashCommand;
    } else {
      preset.slashCommand = id;
    }
    if (source.scopeHint !== undefined || source.scopes !== undefined) {
      preset.scopeHint = normalizeScopeHints(source.scopeHint ?? source.scopes);
    }
    if (source.hidden !== undefined) {
      preset.hidden = normalizeBoolean(source.hidden);
    }
    if (source.showInSidebar !== undefined) {
      preset.showInSidebar = normalizeBoolean(source.showInSidebar);
    }

    presets.push(preset);
  }

  return { presets, error: null };
}

export function toEditableCustomPreset(
  preset: ParsedCustomCommandPreset,
): EditableCustomCommandPreset {
  return {
    aliasesText: serializeStringArray(preset.aliases || []),
    description: String(preset.description || "").trim(),
    enabled: true,
    evidenceHint: Boolean(preset.evidenceHint),
    group: normalizePresetGroup(preset.group),
    hidden: Boolean(preset.hidden),
    id: preset.id,
    label: String(preset.label || "").trim(),
    promptPrefix: String(preset.promptPrefix || "").trim(),
    slashCommand: String(preset.slashCommand || preset.id || "").trim(),
    showInSidebar: Boolean(preset.showInSidebar),
    scopeHint: (preset.scopeHint || ["paper", "pdf"]) as ScopeType[],
  };
}

export function createEmptyEditableCustomPreset(
  index = 0,
): EditableCustomCommandPreset {
  return {
    aliasesText: "",
    description: "",
    enabled: true,
    evidenceHint: false,
    group: "reading",
    hidden: false,
    id: `custom-action-${index + 1}`,
    label: "",
    promptPrefix: "",
    slashCommand: `custom-action-${index + 1}`,
    showInSidebar: false,
    scopeHint: ["paper", "pdf"],
  };
}

export function parseEditableCustomPresets(
  value: string,
): EditableCustomCommandPreset[] {
  return parseCustomPresets(value).presets.map((preset) =>
    toEditableCustomPreset(preset),
  );
}

export function stringifyEditableCustomPresets(
  presets: EditableCustomCommandPreset[],
): string {
  const normalized = presets
    .filter((preset) => preset.enabled !== false || preset.hidden)
    .map((preset, index) => {
      const id = slugifyPresetId(preset.id || preset.label, index);
      return {
        aliases: normalizeStringArray(preset.aliasesText),
        description: String(preset.description || "").trim(),
        evidenceHint: Boolean(preset.evidenceHint),
        group: normalizePresetGroup(preset.group),
        hidden: Boolean(preset.hidden),
        id,
        label: String(preset.label || "").trim(),
        promptPrefix: String(preset.promptPrefix || "").trim(),
        slashCommand: String(preset.slashCommand || id).trim(),
        showInSidebar: Boolean(preset.showInSidebar),
        scopeHint: preset.scopeHint?.length
          ? preset.scopeHint
          : ["paper", "pdf"],
      };
    })
    .filter((preset) => preset.label || preset.promptPrefix);

  if (normalized.length === 0) {
    return "";
  }

  return JSON.stringify(normalized, null, 2);
}

export function buildCustomCommandAIPrompt(): string {
  return [
    "Create Deepseek Copliot custom slash commands as a JSON array",
    "Output JSON only, with no Markdown fences and no explanation",
    "Each object may include id, label, description, promptPrefix, aliases, scopeHint, showInSidebar, and evidenceHint",
    'Use lower-case hyphenated ids, aliases as an array, and scopeHint values from ["paper","pdf","collection","manual-selection"]',
    "Keep showInSidebar true only for the few commands that should appear on the sidebar home panel",
    "Write promptPrefix text for research reading: be specific, ask for concise structure, separate paper evidence from inference, and ask for uncertainty when relevant",
    "My command ideas are:",
  ].join("\n");
}

export function mergeEditableCustomPresets(
  existing: EditableCustomCommandPreset[],
  imported: EditableCustomCommandPreset[],
): EditableCustomCommandPreset[] {
  const merged = [...existing];
  for (const preset of imported) {
    const index = merged.findIndex((candidate) => candidate.id === preset.id);
    if (index >= 0) {
      merged[index] = preset;
    } else {
      merged.push(preset);
    }
  }
  return merged;
}

export function getSettings(): Settings {
  return {
    apiKey: (getPref("apiKey") || "") as string,
    baseURL: DEEPSEEK_BASE_URL,
    customPresets: normalizeCustomPresetsValue(getPref("customPresets")),
    model: normalizeModel(getPref("model") as string | undefined),
    maxContextBudget: Number(
      getPref("maxContextBudget") || DEFAULT_SETTINGS.maxContextBudget,
    ),
    keyboardShortcut: (getPref("keyboardShortcut") ||
      DEFAULT_SETTINGS.keyboardShortcut) as string,
    evidenceEnabled: normalizeBoolean(getPref("evidenceEnabled")),
    evidenceProviderMode: normalizeEvidenceProviderMode(
      getPref("evidenceProviderMode") as string | undefined,
    ),
    tavilyApiKey: (getPref("tavilyApiKey") || "") as string,
  };
}

export function saveSettings(settings: Partial<PersistedSettings>): void {
  if (settings.apiKey !== undefined) setPref("apiKey", settings.apiKey);
  if (settings.customPresets !== undefined)
    setPref(
      "customPresets",
      normalizeCustomPresetsValue(settings.customPresets),
    );
  if (settings.model !== undefined)
    setPref("model", normalizeModel(settings.model));
  if (settings.maxContextBudget !== undefined)
    setPref("maxContextBudget", settings.maxContextBudget);
  if (settings.keyboardShortcut !== undefined)
    setPref("keyboardShortcut", settings.keyboardShortcut);
  if (settings.evidenceEnabled !== undefined)
    setPref("evidenceEnabled", settings.evidenceEnabled);
  if (settings.evidenceProviderMode !== undefined)
    setPref(
      "evidenceProviderMode",
      normalizeEvidenceProviderMode(settings.evidenceProviderMode),
    );
  if (settings.tavilyApiKey !== undefined)
    setPref("tavilyApiKey", settings.tavilyApiKey);
}

export function getSettingsIssue(
  settings: Settings = getSettings(),
): string | null {
  if (!settings.apiKey.trim()) {
    return "DeepSeek API key not configured. Open plugin Settings to continue.";
  }

  return null;
}

export function getEvidenceSettingsIssue(
  settings: Settings = getSettings(),
): string | null {
  if (settings.evidenceProviderMode !== "tavily") {
    return null;
  }

  if (!settings.tavilyApiKey.trim()) {
    return "Tavily API key not configured. Open plugin Settings to enable web verification.";
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
    evidenceProviderMode: normalizeEvidenceProviderMode(
      overrides.evidenceProviderMode ?? settings.evidenceProviderMode,
    ),
    model: normalizeModel(overrides.model ?? settings.model),
    tavilyApiKey: String(overrides.tavilyApiKey ?? settings.tavilyApiKey ?? ""),
  };
}

export function getEvidenceAuditLabel(
  providerMode: EvidenceProviderMode,
): string {
  return providerMode === "tavily" ? "Tavily" : "默认查证";
}

export async function validateSettings(overrides?: Partial<Settings>): Promise<{
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

export async function validateEvidenceSettings(
  overrides?: Partial<Settings>,
): Promise<{
  valid: boolean;
  error?: string;
}> {
  const settings = mergeSettings(overrides);

  if (settings.evidenceProviderMode !== "tavily") {
    return { valid: true };
  }

  if (!settings.tavilyApiKey.trim()) {
    return { valid: false, error: "Tavily API key is required" };
  }

  try {
    const response = await sendTavilyValidationRequest(settings, 8000);
    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid Tavily API key" };
      }
      return {
        valid: false,
        error: `Tavily error: ${response.status}`,
      };
    }

    return { valid: true };
  } catch (e: any) {
    const status = Number(e?.status ?? e?.xhr?.status ?? 0);
    if (status === 401) {
      return { valid: false, error: "Invalid Tavily API key" };
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

async function sendTavilyValidationRequest(
  settings: Settings,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  status: number;
}> {
  const response = await sendJsonRequest(
    `${TAVILY_BASE_URL}/search`,
    {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.tavilyApiKey}`,
    },
    JSON.stringify({
      query: "latest peer reviewed findings on retrieval augmented generation",
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      max_results: 1,
      topic: "general",
    }),
    timeoutMs,
  );

  return {
    ok: response.ok,
    status: response.status,
  };
}

async function sendJsonRequest(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number }> {
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
    if (
      String(error?.message || "").includes(`Timed out after ${timeoutMs}ms`)
    ) {
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
      setTimeout: (callback, timeoutMs) =>
        globalSetTimeout(callback, timeoutMs),
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
      setTimeout: (callback, timeoutMs) =>
        mainWindow.setTimeout?.(callback, timeoutMs),
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
