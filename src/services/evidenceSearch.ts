import type { ScopeContext } from "../types/scope";
import { DEEPSEEK_BASE_URL, getSettings } from "./settingsManager";

export interface EvidenceSearchItem {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

export interface EvidenceSearchResult {
  items: EvidenceSearchItem[];
}

export async function searchEvidence(
  question: string,
  scope?: ScopeContext,
): Promise<EvidenceSearchResult> {
  const settings = getSettings();
  const query = buildEvidenceQuery(question, scope);

  return searchWithDeepSeek(query, settings.apiKey);
}

function buildEvidenceQuery(question: string, scope?: ScopeContext): string {
  const parts = [question.trim()];
  if (scope?.selectedText) {
    parts.push(scope.selectedText.slice(0, 200));
  } else if (scope?.label) {
    parts.push(scope.label);
  }

  const fullQuery = parts.filter(Boolean).join(" ").trim();
  // DeepSeek Search API 要求 query 长度为 1-128 个 Unicode 字符
  if (fullQuery.length === 0) {
    return "research";
  }
  if (fullQuery.length > 128) {
    return fullQuery.slice(0, 128);
  }
  return fullQuery;
}

async function searchWithDeepSeek(
  query: string,
  apiKey: string,
): Promise<EvidenceSearchResult> {
  if (!apiKey.trim()) {
    throw new Error("DeepSeek API Key 未配置，无法进行联网搜索");
  }

  const url = `${DEEPSEEK_BASE_URL}/v1/tools/search`;

  try {
    const payload = await requestJson<{
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        summary?: string;
      }>;
    }>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        count: 5,
        need_content: true,
      }),
    });

    return {
      items: (payload.results || []).map((item) => ({
        title: item.title || "无标题结果",
        url: item.url || "",
        snippet: item.summary || "",
        content: item.content,
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`DeepSeek 搜索失败：${message}`);
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<T> {
  const response = await fetchWithTimeout(url, init, timeoutMs);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
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

  const timeoutHost = resolveTimeoutHost();
  let timeoutId: unknown = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = timeoutHost.setTimeout(() => {
      controller?.abort?.();
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(input, {
        ...init,
        signal: controller?.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId != null) {
      timeoutHost.clearTimeout(timeoutId);
    }
  }
}

function resolveTimeoutHost(): {
  clearTimeout: (timerId: unknown) => void;
  setTimeout: (callback: () => void, timeoutMs: number) => unknown;
} {
  const globalSetTimeout = (globalThis as any).setTimeout;
  const globalClearTimeout = (globalThis as any).clearTimeout;
  if (typeof globalSetTimeout === "function" && typeof globalClearTimeout === "function") {
    return {
      clearTimeout: (timerId) => globalClearTimeout(timerId),
      setTimeout: (callback, timeoutMs) => globalSetTimeout(callback, timeoutMs),
    };
  }

  const win = Zotero.getMainWindow?.() as
    | {
        clearTimeout?: (timerId: unknown) => void;
        setTimeout?: (callback: () => void, timeoutMs: number) => unknown;
      }
    | undefined;

  return {
    clearTimeout: (timerId) => win?.clearTimeout?.(timerId),
    setTimeout: (callback, timeoutMs) => {
      if (typeof win?.setTimeout === "function") {
        return win.setTimeout(callback, timeoutMs);
      }
      callback();
      return timeoutMs;
    },
  };
}
