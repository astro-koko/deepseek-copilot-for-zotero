import { version } from "../../package.json";
import { chatSessionStore, type ChatSessionState } from "./chatSession";
import { getCurrentScope } from "./scopeResolver";
import type { ScopeContext } from "../types/scope";
import { getPref, setPref } from "../utils/prefs";

const DEFAULT_QUESTION = "这篇论文最后一页讲了什么？";
const DEFAULT_SCOPE_WAIT_MS = 15_000;
const SCOPE_POLL_INTERVAL_MS = 250;

type HostSmokeStatus = "skipped" | "success" | "error";
type HostSmokeSkipReason = "not-configured" | "already-handled";

interface HostSmokeConfig {
  outputPath: string;
  question: string;
  runId: string;
  scope?: ScopeContext;
  waitMs: number;
}

interface HostSmokeDiagnosticsSnapshot {
  lastContextAssembly?: unknown;
  lastProviderRequest?: unknown;
}

interface HostSmokeDeps {
  clearDiagnostics(): void;
  getCurrentScope(): ScopeContext | null;
  getDiagnostics(): HostSmokeDiagnosticsSnapshot;
  getPref(key: string): unknown;
  getSnapshot(): ChatSessionState;
  newThread(scope: ScopeContext): Promise<unknown>;
  now(): Date;
  resetSession(): void;
  send(
    message: string,
    scope: ScopeContext,
    options: { evidenceEnabled: boolean },
  ): Promise<void>;
  setPref(key: string, value: unknown): void;
  sleep(ms: number): Promise<void>;
  writeFile(path: string, content: string): void;
}

interface HostSmokeReportBase {
  finishedAt?: string;
  runId?: string;
  startedAt?: string;
  status: HostSmokeStatus;
}

interface HostSmokeSkippedReport extends HostSmokeReportBase {
  reason: HostSmokeSkipReason;
  status: "skipped";
}

interface HostSmokeRunReport extends HostSmokeReportBase {
  assistantMessage?: string;
  contextAssembly?: unknown;
  error?: string;
  markers?: Record<string, boolean>;
  outputPath?: string;
  providerRequest?: unknown;
  question?: string;
  scope?: ScopeContext;
  sessionError?: string | null;
}

export type HostSmokeReport = HostSmokeSkippedReport | HostSmokeRunReport;

let activeRunId: string | null = null;
let activeRunPromise: Promise<HostSmokeReport> | null = null;

export async function maybeRunConfiguredHostSmoke(
  deps: HostSmokeDeps = createDefaultDeps(),
): Promise<HostSmokeReport> {
  const config = readHostSmokeConfig(deps);
  if (!config) {
    return {
      reason: "not-configured",
      status: "skipped",
    };
  }

  const handledRunId = String(deps.getPref("hostSmokeHandledRunId") || "").trim();
  if (handledRunId && handledRunId === config.runId) {
    return {
      reason: "already-handled",
      runId: config.runId,
      status: "skipped",
    };
  }

  if (activeRunPromise && activeRunId === config.runId) {
    return activeRunPromise;
  }

  activeRunId = config.runId;
  activeRunPromise = runConfiguredHostSmoke(config, deps).finally(() => {
    activeRunId = null;
    activeRunPromise = null;
  });

  return activeRunPromise;
}

export function __resetHostSmokeForTests(): void {
  activeRunId = null;
  activeRunPromise = null;
}

function readHostSmokeConfig(deps: Pick<HostSmokeDeps, "getPref">): HostSmokeConfig | null {
  const runId = String(deps.getPref("hostSmokeRunId") || "").trim();
  if (!runId) {
    return null;
  }

  const question = String(deps.getPref("hostSmokeQuestion") || DEFAULT_QUESTION).trim() ||
    DEFAULT_QUESTION;
  const waitMs = normalizePositiveInteger(
    deps.getPref("hostSmokeWaitMs"),
    DEFAULT_SCOPE_WAIT_MS,
  );
  const configuredOutputPath = String(deps.getPref("hostSmokeOutputPath") || "").trim();
  const outputPath =
    configuredOutputPath ||
    `/tmp/deepseek-copliot-live-smoke-${sanitizeRunId(runId)}.json`;
  const scope = parseConfiguredScope(deps.getPref("hostSmokeScopeJson"));

  return {
    outputPath,
    question,
    runId,
    scope,
    waitMs,
  };
}

async function runConfiguredHostSmoke(
  config: HostSmokeConfig,
  deps: HostSmokeDeps,
): Promise<HostSmokeReport> {
  const startedAt = deps.now().toISOString();
  deps.clearDiagnostics();

  try {
    const scope =
      config.scope ?? (await waitForSupportedScope(config.waitMs, deps));

    if (!isSupportedHostSmokeScope(scope)) {
      throw new Error("当前仅支持单篇论文或当前 PDF 的全文模式。");
    }

    deps.resetSession();
    await deps.newThread(scope);
    await deps.send(config.question, scope, { evidenceEnabled: false });

    const snapshot = deps.getSnapshot();
    const assistantMessage = getLastAssistantMessage(snapshot);
    if (snapshot.error) {
      throw new Error(snapshot.error);
    }
    if (!assistantMessage) {
      throw new Error("Smoke run finished without an assistant reply.");
    }

    const report: HostSmokeRunReport = {
      assistantMessage,
      contextAssembly: deps.getDiagnostics().lastContextAssembly,
      finishedAt: deps.now().toISOString(),
      markers: buildAnswerMarkers(assistantMessage),
      outputPath: config.outputPath,
      providerRequest: deps.getDiagnostics().lastProviderRequest,
      question: config.question,
      runId: config.runId,
      scope,
      sessionError: snapshot.error,
      startedAt,
      status: "success",
    };
    persistRunReport(report, deps);
    return report;
  } catch (error) {
    const report: HostSmokeRunReport = {
      contextAssembly: deps.getDiagnostics().lastContextAssembly,
      error: error instanceof Error ? error.message : String(error),
      finishedAt: deps.now().toISOString(),
      outputPath: config.outputPath,
      providerRequest: deps.getDiagnostics().lastProviderRequest,
      question: config.question,
      runId: config.runId,
      sessionError: deps.getSnapshot().error,
      startedAt,
      status: "error",
    };
    persistRunReport(report, deps);
    return report;
  }
}

async function waitForSupportedScope(
  waitMs: number,
  deps: Pick<HostSmokeDeps, "getCurrentScope" | "sleep">,
): Promise<ScopeContext> {
  const attempts =
    Math.max(0, Math.floor(waitMs / SCOPE_POLL_INTERVAL_MS)) + 1;
  let lastScope: ScopeContext | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastScope = deps.getCurrentScope();
    if (isSupportedHostSmokeScope(lastScope)) {
      return lastScope;
    }
    if (attempt < attempts - 1) {
      await deps.sleep(SCOPE_POLL_INTERVAL_MS);
    }
  }

  if (lastScope && !isSupportedHostSmokeScope(lastScope)) {
    throw new Error("当前仅支持单篇论文或当前 PDF 的全文模式。");
  }
  throw new Error("未能在 Zotero 中解析到可用的单篇论文或当前 PDF 范围。");
}

function parseConfiguredScope(value: unknown): ScopeContext | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ScopeContext> | null;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    if (parsed.type !== "paper" && parsed.type !== "pdf") {
      return undefined;
    }
    if (!parsed.id || !Array.isArray(parsed.itemIds)) {
      return undefined;
    }
    if (parsed.type === "pdf" && typeof parsed.readerAttachmentId !== "number") {
      return undefined;
    }
    return parsed as ScopeContext;
  } catch {
    return undefined;
  }
}

function persistRunReport(
  report: HostSmokeRunReport,
  deps: Pick<HostSmokeDeps, "setPref" | "writeFile">,
): void {
  if (report.runId) {
    deps.setPref("hostSmokeHandledRunId", report.runId);
  }
  deps.setPref("hostSmokeLastStatus", report.status);
  if (report.outputPath) {
    deps.setPref("hostSmokeLastOutputPath", report.outputPath);
    deps.writeFile(report.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
}

function getLastAssistantMessage(snapshot: ChatSessionState): string {
  const messages = snapshot.activeThread?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") {
      return messages[index]?.content || "";
    }
  }
  return "";
}

function buildAnswerMarkers(answer: string): Record<string, boolean> {
  return {
    diffusionGuidance: /diffusion guidance/i.test(answer),
    figureA7: /figure\s*a7/i.test(answer),
    figureA8: /figure\s*a8/i.test(answer),
    generalGuidance: /general guidance/i.test(answer),
    selfRecurrence: /self-recurrence/i.test(answer),
    twoMoons: /two moons/i.test(answer),
  };
}

function isSupportedHostSmokeScope(
  scope: ScopeContext | null | undefined,
): scope is ScopeContext {
  return scope?.type === "paper" || scope?.type === "pdf";
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric =
    typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function sanitizeRunId(runId: string): string {
  return runId.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function createDefaultDeps(): HostSmokeDeps {
  return {
    clearDiagnostics() {
      const diagnostics = ((globalThis as any).__aiAssistantDiagnostics ??= {});
      delete diagnostics.lastContextAssembly;
      delete diagnostics.lastProviderRequest;
    },
    getCurrentScope,
    getDiagnostics() {
      return ((globalThis as any).__aiAssistantDiagnostics ??= {});
    },
    getPref,
    getSnapshot() {
      return chatSessionStore.getSnapshot();
    },
    async newThread(scope: ScopeContext) {
      await chatSessionStore.newThread(scope);
    },
    now() {
      return new Date();
    },
    resetSession() {
      chatSessionStore.reset();
    },
    async send(message: string, scope: ScopeContext, options) {
      await chatSessionStore.send(message, scope, options);
    },
    setPref,
    async sleep(ms: number) {
      const schedule =
        (globalThis as unknown as {
          setTimeout?: (handler: TimerHandler, timeout?: number) => number;
        }).setTimeout;
      await new Promise((resolve) => {
        if (typeof schedule === "function") {
          schedule(() => resolve(undefined), ms);
          return;
        }
        resolve(undefined);
      });
    },
    writeFile(path: string, content: string) {
      const target =
        typeof Zotero?.File?.pathToFile === "function"
          ? Zotero.File.pathToFile(path)
          : path;
      Zotero.File?.putContents?.(target as unknown as nsIFile, content);
    },
  };
}
