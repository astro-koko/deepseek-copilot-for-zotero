import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScopeContext } from "../types/scope";
import type { ChatSessionState } from "./chatSession";
import {
  __resetHostSmokeForTests,
  maybeRunConfiguredHostSmoke,
} from "./hostSmoke";

const FIXED_NOW = new Date("2026-06-10T09:30:00.000Z");

const PDF_SCOPE: ScopeContext = {
  type: "pdf",
  id: "pdf-42",
  label: "All-in-one simulation-based inference",
  itemIds: [17],
  readerAttachmentId: 42,
};

function makeThread(assistantMessage: string) {
  return {
    id: "thread-1",
    title: "Smoke Thread",
    createdAt: 1,
    updatedAt: 2,
    scopeSnapshot: PDF_SCOPE,
    messages: [
      {
        id: "msg-user-1",
        role: "user" as const,
        content: "这篇论文最后一页讲了什么？",
        timestamp: 1,
      },
      {
        id: "msg-assistant-1",
        role: "assistant" as const,
        content: assistantMessage,
        timestamp: 2,
      },
    ],
  };
}

function createDeps(options?: {
  currentScopes?: Array<ScopeContext | null>;
  handledRunId?: string;
  runId?: string;
  scopeJson?: string;
  sendImpl?: () => Promise<void>;
  waitMs?: number;
}) {
  const prefState = new Map<string, unknown>();
  if (options?.runId) {
    prefState.set("hostSmokeRunId", options.runId);
  }
  if (options?.handledRunId) {
    prefState.set("hostSmokeHandledRunId", options.handledRunId);
  }
  if (options?.scopeJson) {
    prefState.set("hostSmokeScopeJson", options.scopeJson);
  }
  if (options?.waitMs != null) {
    prefState.set("hostSmokeWaitMs", options.waitMs);
  }

  let scopeIndex = 0;
  const scopes = options?.currentScopes ?? [PDF_SCOPE];
  let snapshot: ChatSessionState = {
    activeThread: null,
    error: null,
    isStreaming: false,
    streamingContent: "",
  };

  const writes: Array<{ path: string; content: string }> = [];
  const defaultAssistantMessage =
    "The final page discusses Figure A7, Figure A8, diffusion guidance, self-recurrence, and Two Moons.";

  const deps = {
    clearDiagnostics: vi.fn(),
    getCurrentScope: vi.fn(() => {
      const scope =
        scopes[Math.min(scopeIndex, scopes.length - 1)] ?? null;
      scopeIndex += 1;
      return scope;
    }),
    getDiagnostics: vi.fn(() => ({
      lastContextAssembly: {
        fullTextChars: 94299,
        fullTextSource: "attachment-text",
      },
      lastProviderRequest: {
        fullTextChars: 94299,
        fullTextSource: "attachment-text",
        systemPromptChars: 96001,
      },
    })),
    getPref: vi.fn((key: string) => prefState.get(key)),
    getSnapshot: vi.fn(() => snapshot),
    newThread: vi.fn(async () => {
      snapshot = {
        ...snapshot,
        activeThread: makeThread(""),
      };
    }),
    now: vi.fn(() => FIXED_NOW),
    resetSession: vi.fn(() => {
      snapshot = {
        activeThread: null,
        error: null,
        isStreaming: false,
        streamingContent: "",
      };
    }),
    send: vi.fn(
      options?.sendImpl ??
        (async () => {
          snapshot = {
            ...snapshot,
            activeThread: makeThread(defaultAssistantMessage),
          };
        }),
    ),
    setPref: vi.fn((key: string, value: unknown) => {
      prefState.set(key, value);
    }),
    sleep: vi.fn(async () => {}),
    writeFile: vi.fn((path: string, content: string) => {
      writes.push({ path, content });
    }),
  };

  return { deps, prefState, writes };
}

describe("hostSmoke", () => {
  beforeEach(() => {
    __resetHostSmokeForTests();
  });

  it("skips when no smoke run is configured", async () => {
    const { deps, writes } = createDeps();

    const result = await maybeRunConfiguredHostSmoke(deps);

    expect(result).toEqual({
      reason: "not-configured",
      status: "skipped",
    });
    expect(deps.send).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("runs a configured smoke once and writes a success report", async () => {
    const { deps, prefState, writes } = createDeps({
      runId: "pdf-live-1",
      scopeJson: JSON.stringify(PDF_SCOPE),
    });

    const result = await maybeRunConfiguredHostSmoke(deps);

    expect(result.status).toBe("success");
    expect(deps.resetSession).toHaveBeenCalledTimes(1);
    expect(deps.newThread).toHaveBeenCalledWith(PDF_SCOPE);
    expect(deps.send).toHaveBeenCalledWith(
      "这篇论文最后一页讲了什么？",
      PDF_SCOPE,
      { evidenceEnabled: false },
    );
    expect(prefState.get("hostSmokeHandledRunId")).toBe("pdf-live-1");
    expect(prefState.get("hostSmokeLastStatus")).toBe("success");
    expect(prefState.get("hostSmokeLastOutputPath")).toBe(
      "/tmp/deepseek-copliot-live-smoke-pdf-live-1.json",
    );
    expect(writes).toHaveLength(1);

    const report = JSON.parse(writes[0].content);
    expect(report.status).toBe("success");
    expect(report.scope.type).toBe("pdf");
    expect(report.assistantMessage).toContain("Figure A7");
    expect(report.markers.figureA7).toBe(true);
    expect(report.markers.figureA8).toBe(true);
    expect(report.providerRequest.fullTextChars).toBe(94299);
  });

  it("does not rerun a smoke with the same handled run id", async () => {
    const { deps, writes } = createDeps({
      runId: "pdf-live-1",
      handledRunId: "pdf-live-1",
      scopeJson: JSON.stringify(PDF_SCOPE),
    });

    const result = await maybeRunConfiguredHostSmoke(deps);

    expect(result).toEqual({
      reason: "already-handled",
      runId: "pdf-live-1",
      status: "skipped",
    });
    expect(deps.send).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("polls current scope until a supported scope appears", async () => {
    const { deps } = createDeps({
      runId: "paper-live-1",
      currentScopes: [
        null,
        {
          type: "manual-selection",
          id: "selection-1-2",
          label: "2 items selected",
          itemIds: [1, 2],
        },
        PDF_SCOPE,
      ],
      waitMs: 500,
    });

    const result = await maybeRunConfiguredHostSmoke(deps);

    expect(result.status).toBe("success");
    expect(deps.getCurrentScope).toHaveBeenCalledTimes(3);
    expect(deps.sleep).toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledTimes(1);
  });

  it("writes an error report when no supported scope becomes available", async () => {
    const { deps, prefState, writes } = createDeps({
      runId: "unsupported-live-1",
      currentScopes: [
        {
          type: "collection",
          id: "collection-7",
          label: "My Collection",
          itemIds: [7, 8],
        },
      ],
      waitMs: 200,
    });

    const result = await maybeRunConfiguredHostSmoke(deps);

    expect(result.status).toBe("error");
    expect(result.runId).toBe("unsupported-live-1");
    expect(deps.send).not.toHaveBeenCalled();
    expect(prefState.get("hostSmokeHandledRunId")).toBe("unsupported-live-1");
    expect(prefState.get("hostSmokeLastStatus")).toBe("error");
    expect(writes).toHaveLength(1);

    const report = JSON.parse(writes[0].content);
    expect(report.status).toBe("error");
    expect(report.error).toContain("当前仅支持单篇论文或当前 PDF 的全文模式");
  });
});
