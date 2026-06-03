import type { ScopeContext } from "../types/scope";
import {
  DEFAULT_EVIDENCE_PROVIDER_MODE,
  type EvidenceProviderMode,
  type Settings,
  TAVILY_BASE_URL,
  getSettings,
} from "./settingsManager";

export interface EvidenceSearchItem {
  title: string;
  authors: string[];
  year: string;
  source: string;
  url: string;
  snippet: string;
}

export interface EvidenceSearchResult {
  providerMode: EvidenceProviderMode;
  items: EvidenceSearchItem[];
}

export async function searchEvidence(
  question: string,
  scope?: ScopeContext,
  settings: Settings = getSettings(),
): Promise<EvidenceSearchResult> {
  const query = buildEvidenceQuery(question, scope);
  if (settings.evidenceProviderMode === "tavily") {
    return searchWithTavily(query, settings.tavilyApiKey);
  }
  return searchWithOpenAlex(query);
}

function buildEvidenceQuery(question: string, scope?: ScopeContext): string {
  const parts = [question.trim()];
  if (scope?.selectedText) {
    parts.push(scope.selectedText.slice(0, 300));
  } else if (scope?.label) {
    parts.push(scope.label);
  }

  return parts.filter(Boolean).join(" ").trim();
}

async function searchWithOpenAlex(query: string): Promise<EvidenceSearchResult> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", "5");

  const payload = await requestJson<{
    results?: Array<{
      authorships?: Array<{ author?: { display_name?: string } }>;
      display_name?: string;
      id?: string;
      publication_year?: number;
      primary_location?: {
        landing_page_url?: string;
        source?: { display_name?: string };
      };
      abstract_inverted_index?: Record<string, number[]>;
    }>;
  }>(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return {
    providerMode: DEFAULT_EVIDENCE_PROVIDER_MODE,
    items: (payload.results || []).map((item) => ({
      title: item.display_name || "Untitled result",
      authors: (item.authorships || [])
        .map((author) => author.author?.display_name || "")
        .filter(Boolean)
        .slice(0, 5),
      year: item.publication_year ? String(item.publication_year) : "",
      source: item.primary_location?.source?.display_name || "Academic search",
      url: item.primary_location?.landing_page_url || item.id || "",
      snippet: materializeOpenAlexAbstract(item.abstract_inverted_index),
    })),
  };
}

async function searchWithTavily(
  query: string,
  apiKey: string,
): Promise<EvidenceSearchResult> {
  const payload = await requestJson<{
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
    }>;
  }>(`${TAVILY_BASE_URL}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: 5,
      topic: "general",
    }),
  });

  return {
    providerMode: "tavily",
    items: (payload.results || []).map((item) => ({
      title: item.title || "Untitled result",
      authors: [],
      year: "",
      source: "Tavily",
      url: item.url || "",
      snippet: item.content || "",
    })),
  };
}

function materializeOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | undefined,
): string {
  if (!invertedIndex) {
    return "";
  }

  const positions = Object.entries(invertedIndex).flatMap(([word, indexes]) =>
    indexes.map((index) => ({ index, word })),
  );
  return positions
    .sort((left, right) => left.index - right.index)
    .slice(0, 80)
    .map((entry) => entry.word)
    .join(" ");
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 8000,
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
