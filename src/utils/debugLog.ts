type DebugLogLevel = "debug" | "info" | "warn" | "error";

export type DebugLogSurface =
  | "startup"
  | "settings"
  | "library"
  | "reader"
  | "sidebar"
  | "provider"
  | "export"
  | "persistence";

export interface DebugLogEntry {
  [key: string]: unknown;
  action?: string;
  durationMs?: number;
  errorMessage?: string;
  errorName?: string;
  event: string;
  itemIdsCount?: number;
  level: DebugLogLevel;
  messageChars?: number;
  model?: string;
  page?: number;
  readerItemID?: number;
  scopeId?: string;
  scopeType?: string;
  selectedTextChars?: number;
  status?: string;
  surface?: DebugLogSurface;
  traceId?: string;
  ts: string;
}

type DebugLogFields = Record<string, unknown>;

interface RecordOptions {
  maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 500;
const entries: DebugLogEntry[] = [];

const SECRET_KEY_PATTERN =
  /(?:api[-_]?key|authorization|token|secret|password|cookie)/i;
const CONTENT_KEY_PATTERN =
  /(?:fulltext|full_text|selectedtext|selected_text|prompt|userinput|user_input|content|messages|responsetext|response_text)/i;
const PATH_KEY_PATTERN =
  /(?:profilepath|profile_path|datadir|data_dir|databasepath|database_path|cookiepath|cookie_path)/i;
const SAFE_METADATA_KEY_PATTERN =
  /(?:chars|count|has[A-Z].*|is[A-Z].*|durationMs|status|model|scopeId|scopeType|traceId|surface|action|event|level|ts)$/i;

export const debugLog = {
  debug(event: string, fields?: DebugLogFields, options?: RecordOptions): void {
    recordDebugLog("debug", event, fields, options);
  },
  error(
    event: string,
    error?: unknown,
    fields?: DebugLogFields,
    options?: RecordOptions,
  ): void {
    recordDebugLog(
      "error",
      event,
      {
        ...fields,
        ...formatError(error),
      },
      options,
    );
  },
  info(event: string, fields?: DebugLogFields, options?: RecordOptions): void {
    recordDebugLog("info", event, fields, options);
  },
  warn(event: string, fields?: DebugLogFields, options?: RecordOptions): void {
    recordDebugLog("warn", event, fields, options);
  },
};

export function createTraceId(prefix = "trace"): string {
  const safePrefix =
    prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "trace";
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${safePrefix}-${timePart}-${randomPart}`;
}

export function clearDebugLog(): void {
  entries.length = 0;
}

export function getDebugLogSnapshot(): DebugLogEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

export function serializeDebugLog(
  snapshot: DebugLogEntry[] = getDebugLogSnapshot(),
): string {
  if (snapshot.length === 0) {
    return "";
  }

  return `${snapshot.map((entry) => JSON.stringify(entry)).join("\n")}\n`;
}

export async function exportDebugLog(outputPath: string): Promise<string> {
  const payload = serializeDebugLog();
  const fileApi = (globalThis as typeof globalThis & {
    Zotero?: {
      File?: {
        pathToFile?: (path: string) => nsIFile | string;
        putContents?: (path: string | nsIFile, data: string) => void;
        putContentsAsync?: (
          path: string | nsIFile,
          data: string,
          charset?: string,
        ) => Promise<void>;
      };
    };
  }).Zotero?.File;

  if (!fileApi) {
    throw new Error("No Zotero file API is available for debug log export");
  }

  const target =
    typeof fileApi.pathToFile === "function"
      ? fileApi.pathToFile(outputPath)
      : outputPath;

  if (typeof fileApi.putContentsAsync === "function") {
    await fileApi.putContentsAsync(target, payload, "utf-8");
    return outputPath;
  }

  if (typeof fileApi.putContents === "function") {
    fileApi.putContents(target, payload);
    return outputPath;
  }

  throw new Error("No writable Zotero file API is available for debug log export");
}

function recordDebugLog(
  level: DebugLogLevel,
  event: string,
  fields: DebugLogFields = {},
  options: RecordOptions = {},
): void {
  try {
    const entry: DebugLogEntry = {
      ...sanitizeFields(fields),
      event,
      level,
      ts: new Date().toISOString(),
    };
    entries.push(entry);
    trimEntries(options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    forwardToHostLog(entry);
  } catch {
    // Diagnostics must never change product behavior.
  }
}

function trimEntries(maxEntries: number): void {
  const limit = Number.isFinite(maxEntries) && maxEntries > 0
    ? Math.floor(maxEntries)
    : DEFAULT_MAX_ENTRIES;
  if (entries.length <= limit) {
    return;
  }
  entries.splice(0, entries.length - limit);
}

function sanitizeFields(fields: DebugLogFields): DebugLogFields {
  const sanitized: DebugLogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (SAFE_METADATA_KEY_PATTERN.test(key)) {
    return value;
  }

  if (SECRET_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (PATH_KEY_PATTERN.test(key)) {
    return "[redacted-path]";
  }

  if (CONTENT_KEY_PATTERN.test(key)) {
    if (typeof value === "string") {
      return {
        chars: value.length,
        redacted: true,
      };
    }
    if (Array.isArray(value)) {
      return {
        count: value.length,
        redacted: true,
      };
    }
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (typeof value === "object") {
    const nested: DebugLogFields = {};
    for (const [nestedKey, nestedValue] of Object.entries(
      value as DebugLogFields,
    )) {
      nested[nestedKey] = sanitizeValue(nestedKey, nestedValue);
    }
    return nested;
  }

  return value;
}

function formatError(error: unknown): Pick<
  DebugLogEntry,
  "errorMessage" | "errorName"
> {
  if (!error) {
    return {};
  }

  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
    };
  }

  return {
    errorMessage: String(error),
    errorName: "Error",
  };
}

function forwardToHostLog(entry: DebugLogEntry): void {
  try {
    const logger = (globalThis as typeof globalThis & {
      ztoolkit?: { log?: (...args: unknown[]) => void };
    }).ztoolkit?.log;
    if (typeof logger !== "function") {
      return;
    }
    logger("[Deepseek Copliot debug]", entry);
  } catch {
    // Host logging is best-effort.
  }
}
