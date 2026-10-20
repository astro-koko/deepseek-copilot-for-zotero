import type { ScopeContext } from "../types/scope";
import type { CurrentPaperIdentity } from "../types/evidence";
import { DEEPSEEK_BASE_URL, getSettings } from "./settingsManager";
import { debugLog } from "../utils/debugLog";
import {
  planEvidenceQueries,
  type EvidenceQueryPlan,
} from "./evidenceQueryPlanner";
import {
  filterAndGroupEvidence,
  type RawEvidenceRecord,
} from "./evidenceResultFilter";

export interface EvidenceSearchItem {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  summary?: string;
  rerankScore?: number;
  authority?: number;
  date?: string | null;
  siteName?: string;
  queryIndex?: number;
}

export interface EvidenceSearchQueryStatus {
  status: "success" | "empty" | "error";
  resultCount: number;
  queryChars: number;
  durationMs: number;
  errorMessage?: string;
}

export interface EvidenceSearchPlan {
  intent: EvidenceQueryPlan["intent"];
  queries: EvidenceSearchQueryStatus[];
  workDupesMerged?: number;
}

export interface EvidenceSearchResult {
  // 独立相关文献（已完成去重与主论文折叠）。
  items: EvidenceSearchItem[];
  // 当前论文自身的目录/索引页记录，仅在识别到主论文时出现。
  mainPaperItems?: EvidenceSearchItem[];
  plan?: EvidenceSearchPlan;
}

export interface SearchEvidenceOptions {
  currentPaper?: CurrentPaperIdentity;
  // 上一轮的用户问题，供 planner 做追问意图继承。
  priorQuestion?: string;
  // 当前论文全文，供 planner 提取内容锚点（巡天/方法缩写）作为第二条
  // 检索角度。
  paperFullText?: string;
  // 上层（如 chatEngine 的两段式检索）给出的补充检索式；与规划查询
  // 一起走同一扇出与去重链路。1-128 Unicode 字符，超限裁剪。
  extraQuery?: string;
}

export async function searchEvidence(
  question: string,
  scope?: ScopeContext,
  options?: SearchEvidenceOptions,
): Promise<EvidenceSearchResult> {
  const settings = getSettings();
  const plan = planEvidenceQueries(question, scope, {
    priorQuestion: options?.priorQuestion,
    paperFullText: options?.paperFullText,
  });
  pushExtraQuery(plan, options?.extraQuery);
  return searchWithDeepSeek(plan, settings.apiKey, options);
}

// 两段式检索的第二段：把模型提炼的补充查询追加进执行计划（≤2 条总预算
// 由 MAX_QUERIES_PER_TURN 之外的独立容量承担，去重后空转则忽略）。
function pushExtraQuery(plan: EvidenceQueryPlan, extraQuery?: string): void {
  const trimmed = (extraQuery || "").trim();
  if (!trimmed) return;
  const query = truncateCharacters(trimmed, 128);
  if (!query) return;
  const duplicate = plan.queries.some(
    (planned) =>
      planned.query.toLowerCase().replace(/\s+/g, " ") ===
      query.toLowerCase().replace(/\s+/g, " "),
  );
  if (!duplicate) {
    plan.queries.push({ query, count: 10 });
  }
}

function truncateCharacters(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join("");
}

interface DeepSeekSearchResultEntry {
  title?: string;
  url?: string;
  content?: string;
  summary?: string;
  snippet?: string;
  rerank_score?: number;
  authority?: number;
  date?: string | null;
  site_name?: string | null;
}

interface QueryOutcome {
  ok: boolean;
  records: RawEvidenceRecord[];
  status: EvidenceSearchQueryStatus;
}

async function searchWithDeepSeek(
  plan: EvidenceQueryPlan,
  apiKey: string,
  options?: SearchEvidenceOptions,
): Promise<EvidenceSearchResult> {
  if (!apiKey.trim()) {
    throw new Error("DeepSeek API Key 未配置，无法进行联网搜索");
  }

  const url = `${DEEPSEEK_BASE_URL}/v1/tools/search`;
  const startedAt = Date.now();

  try {
    let outcomes = await Promise.all(
      plan.queries.map((planned, queryIndex) =>
        runOneQuery(
          url,
          apiKey,
          planned.query,
          planned.count,
          plan.oriQuestion,
          queryIndex,
        ),
      ),
    );

    // 空结果回退：单查询且带运算符的查询（after:/排除）落空时，用
    // 去掉运算符的裸主题词补查一次——限定过紧不该表现为"检索无结果"。
    const totalRecords = outcomes.reduce((sum, o) => sum + o.records.length, 0);
    if (
      totalRecords === 0 &&
      plan.queries.length === 1 &&
      /(?:after:|-")/.test(plan.queries[0].query)
    ) {
      const bareQuery = plan.queries[0].query
        .replace(/after:\S+/g, "")
        .replace(/-"[^"]*"/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (bareQuery && bareQuery !== plan.queries[0].query) {
        const fallback = await runOneQuery(
          url,
          apiKey,
          bareQuery,
          plan.queries[0].count,
          plan.oriQuestion,
          plan.queries.length,
        );
        outcomes = [...outcomes, fallback];
      }
    }

    const records = outcomes.flatMap((outcome) => outcome.records);
    const grouped = filterAndGroupEvidence(records, options?.currentPaper);

    const queryStatuses = outcomes.map((outcome) => outcome.status);
    const anySuccess = queryStatuses.some(
      (status) => status.status !== "error",
    );
    if (!anySuccess) {
      const firstError = queryStatuses.find(
        (status) => status.status === "error",
      );
      throw new Error(firstError?.errorMessage || "所有搜索查询均失败");
    }

    debugLog.info("evidence-search-completed", {
      surface: "provider",
      status: grouped.independent.length ? "success" : "empty",
      intent: plan.intent,
      queryCount: plan.queries.length,
      resultCount: grouped.independent.length,
      mainPaperCount: grouped.mainPaper.length,
      workDupesMerged: grouped.stats.workDupesMerged,
      durationMs: Date.now() - startedAt,
    });

    return {
      items: grouped.independent.map(toSearchItem),
      mainPaperItems: grouped.mainPaper.length
        ? grouped.mainPaper.map(toSearchItem)
        : undefined,
      plan: {
        intent: plan.intent,
        queries: queryStatuses,
        workDupesMerged: grouped.stats.workDupesMerged,
      },
    };
  } catch (error) {
    debugLog.warn("evidence-search-failed", {
      surface: "provider",
      status: "error",
      durationMs: Date.now() - startedAt,
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`DeepSeek 搜索失败：${message}`);
  }
}

async function runOneQuery(
  url: string,
  apiKey: string,
  query: string,
  count: number,
  oriQuestion: string,
  queryIndex: number,
): Promise<QueryOutcome> {
  const startedAt = Date.now();
  try {
    const payload = await requestJson<{
      results?: DeepSeekSearchResultEntry[];
    }>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        count,
        // 官方字段：原始用户问题，改善引擎对短查询的解释。
        ...(oriQuestion.trim() ? { ori_question: oriQuestion } : {}),
        need_content: true,
      }),
    });

    if (!payload || !Array.isArray(payload.results)) {
      throw new Error("搜索响应格式无效：缺少 results 数组");
    }
    const records = payload.results.flatMap((item) => {
      if (
        !item ||
        typeof item.url !== "string" ||
        !/^https?:\/\//i.test(item.url)
      ) {
        return [];
      }
      const content =
        typeof item.content === "string" ? item.content.trim() : "";
      const summary =
        (typeof item.summary === "string" && item.summary.trim()) ||
        (typeof item.snippet === "string" && item.snippet.trim()) ||
        "";
      const snippet =
        typeof item.snippet === "string" ? item.snippet.trim() : "";
      if (!content && !summary) return [];
      return [
        {
          title:
            typeof item.title === "string" && item.title.trim()
              ? item.title
              : "无标题结果",
          url: item.url,
          snippet,
          summary: summary || undefined,
          content: content || undefined,
          rerankScore:
            typeof item.rerank_score === "number"
              ? item.rerank_score
              : undefined,
          authority:
            typeof item.authority === "number" ? item.authority : undefined,
          date: typeof item.date === "string" ? item.date : null,
          siteName:
            typeof item.site_name === "string" ? item.site_name : undefined,
          queryIndex,
          positionInQuery: 0,
        } satisfies RawEvidenceRecord,
      ];
    });
    // positionInQuery 按出现顺序补齐，供稳定排序使用。
    records.forEach((record, position) => {
      record.positionInQuery = position;
    });

    return {
      ok: true,
      records,
      status: {
        status: records.length ? "success" : "empty",
        resultCount: records.length,
        queryChars: Array.from(query).length,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      records: [],
      status: {
        status: "error",
        resultCount: 0,
        queryChars: Array.from(query).length,
        durationMs: Date.now() - startedAt,
        errorMessage: message,
      },
    };
  }
}

function toSearchItem(record: RawEvidenceRecord): EvidenceSearchItem {
  return {
    title: record.title,
    url: record.url,
    snippet: record.snippet,
    content: record.content,
    summary: record.summary,
    rerankScore: record.rerankScore,
    authority: record.authority,
    date: record.date,
    siteName: record.siteName,
    queryIndex: record.queryIndex,
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<T> {
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
      (async () => {
        const response = await fetch(url, {
          ...init,
          signal: controller?.signal,
        });
        if (!response.ok) {
          const hint =
            response.status === 401 || response.status === 403
              ? "，请检查 API Key 和搜索权限"
              : response.status === 429
                ? "，请求过于频繁，请稍后重试"
                : "";
          throw new Error(`HTTP ${response.status}${hint}`);
        }
        return (await response.json()) as T;
      })(),
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
  if (
    typeof globalSetTimeout === "function" &&
    typeof globalClearTimeout === "function"
  ) {
    return {
      clearTimeout: (timerId) => globalClearTimeout(timerId),
      setTimeout: (callback, timeoutMs) =>
        globalSetTimeout(callback, timeoutMs),
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
