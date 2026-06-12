import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScopeContext } from "../../types/scope";
import type { Thread } from "../../types/thread";
import type { ChatSessionState } from "../../services/chatSession";
import type { Settings } from "../../services/settingsManager";
import { buildSidebarViewModel } from "./sidebarViewModel";

function makeScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    type: "paper",
    id: "paper-1",
    label: "Paper 1",
    itemIds: [1],
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    title: "Thread 1",
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    ...overrides,
  };
}

function makeSession(overrides: Partial<ChatSessionState> = {}): ChatSessionState {
  return {
    activeThread: null,
    error: null,
    isStreaming: false,
    streamingContent: "",
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    apiKey: "sk-test",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    maxContextBudget: 4000,
    keyboardShortcut: "I",
    evidenceEnabled: false,
    evidenceProviderMode: "mcp-web-search",
    tavilyApiKey: "",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSidebarViewModel", () => {
  it("keeps the shell visible for a no-scope empty state", () => {
    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [],
      scope: null,
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.mode).toBe("empty");
    expect(model.heroTitle).toBe("Select an item");
    expect(model.heroBody).toContain("Choose one paper");
    expect(model.composerDisabled).toBe(true);
    expect(model.showIntroSection).toBe(true);
    expect(model.showInlineComposer).toBe(false);
    expect(model.showDockedComposer).toBe(true);
    expect(model.showShell).toBe(true);
    expect(model.showSuggestedActions).toBe(false);
    expect(model.composerDisabledReason).toBe(
      "Choose one paper in Library or open one PDF in Reader to enable chat.",
    );
  });

  it("shows a configuration state instead of a blank body when the api key is missing", () => {
    const model = buildSidebarViewModel({
      location: "reader",
      recentThreads: [],
      scope: makeScope({ type: "pdf", id: "pdf-1", readerAttachmentId: 1 }),
      session: makeSession(),
      settings: makeSettings({ apiKey: "" }),
      settingsIssue: "DeepSeek API key not configured. Open plugin Settings to continue.",
    });

    expect(model.mode).toBe("config-error");
    expect(model.showShell).toBe(true);
    expect(model.showInlineComposer).toBe(false);
    expect(model.showDockedComposer).toBe(true);
    expect(model.composerDisabled).toBe(true);
    expect(model.noticeText).toContain("API key");
    expect(model.noticeTitle).toBe("Configuration required");
    expect(model.heroTitle).toBe("Configuration required");
    expect(model.heroBody).toBe(
      "Add your DeepSeek API key in Settings.",
    );
  });

  it("shows a Beaver-like home shell when scope exists but the thread is empty", () => {
    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [makeThread({ id: "thread-2", title: "Earlier chat" })],
      scope: makeScope(),
      session: makeSession({
        activeThread: makeThread({ scopeSnapshot: makeScope() }),
      }),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.mode).toBe("home");
    expect(model.showIntroSection).toBe(true);
    expect(model.showSuggestedActions).toBe(true);
    expect(model.showRecentThreads).toBe(false);
    expect(model.showInlineComposer).toBe(true);
    expect(model.showDockedComposer).toBe(false);
    expect(model.composerDisabled).toBe(false);
    expect(model.heroTitle).toBe("Ready to chat");
    expect(model.heroBody).toBe(
      "Pick an action or ask about the current paper.",
    );
    expect(model.providerLabel).toBe("DeepSeek");
    expect(model.statusLabel).toBe("Ready");
    expect(model.suggestedActions).toHaveLength(8);
    expect(model.suggestedActions.map((action) => action.group)).toEqual([
      "reading",
      "reading",
      "reading",
      "analysis",
      "analysis",
      "analysis",
      "evidence",
      "evidence",
    ]);
  });

  // Manual compact pane layout checklist:
  // - Sidebar header renders as a compact title row, not a branded hero card.
  // - Scope, notice, intro, suggested actions, recent chats, streaming, and error
  //   surfaces render as neutral pane sections, not large rounded cards.
  // - Suggested actions and recent chats stay compact stacked rows without
  //   reintroducing promotional hero-card wording.

  it("switches to thread view once persisted messages exist", () => {
    const model = buildSidebarViewModel({
      location: "reader",
      contextSummary: {
        availability: "pdf-text-ready",
        fullText: "PDF text",
        metadata: "Metadata",
        warnings: [],
      },
      recentThreads: [],
      scope: makeScope({ type: "pdf", id: "pdf-1", readerAttachmentId: 1 }),
      session: makeSession({
        activeThread: makeThread({
          messages: [
            {
              id: "msg-1",
              role: "user",
              content: "Summarize this paper",
              timestamp: 1,
            },
          ],
        }),
      }),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.mode).toBe("thread");
    expect(model.showIntroSection).toBe(false);
    expect(model.showThreadView).toBe(true);
    expect(model.showInlineComposer).toBe(false);
    expect(model.showDockedComposer).toBe(true);
    expect(model.composerDisabled).toBe(false);
    expect(model.heroTitle).toBe("Thread");
  });

  it("surfaces context fallback warnings when only abstract content is available", () => {
    const model = buildSidebarViewModel({
      location: "library",
      contextSummary: {
        availability: "abstract-only",
        fullText: "Abstract text",
        metadata: "Metadata",
        warnings: [
          "Using the abstract because no extractable PDF text is available for this scope.",
        ],
      },
      recentThreads: [],
      scope: makeScope(),
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect((model as any).contextAvailabilityLabel).toBe("Abstract fallback");
    expect((model as any).contextWarnings).toContain(
      "Using the abstract because no extractable PDF text is available for this scope.",
    );
  });

  it("keeps collection scope visible but disables chat interactions for the minimal closed loop", () => {
    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [makeThread({ id: "thread-2", title: "Earlier chat" })],
      scope: makeScope({
        type: "collection",
        id: "collection-1",
        label: "My Collection",
        itemIds: [1, 2, 3],
      }),
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.showShell).toBe(true);
    expect(model.composerDisabled).toBe(true);
    expect(model.showInlineComposer).toBe(false);
    expect(model.showDockedComposer).toBe(true);
    expect(model.mode).toBe("empty");
    expect(model.heroTitle).toBe("Choose one paper");
    expect(model.heroBody).toBe(
      "Use one paper or the active PDF.",
    );
    expect(model.composerDisabledReason).toBe(
      "Choose one paper in Library or open one PDF in Reader to enable chat.",
    );
    expect(model.showSuggestedActions).toBe(false);
  });

  it("keeps the provider label neutral when the pro model is persisted", () => {
    const model = buildSidebarViewModel({
      location: "reader",
      recentThreads: [],
      scope: makeScope({ type: "pdf", id: "pdf-1", readerAttachmentId: 1 }),
      session: makeSession(),
      settings: makeSettings({ model: "deepseek-v4-pro" }),
      settingsIssue: null,
    });

    expect(model.providerLabel).toBe("DeepSeek");
  });

  it("uses a shorter composer prompt for supported scopes", () => {
    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [],
      scope: makeScope(),
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.composerPlaceholder).toContain("Ask about this");
  });

  it("uses zh-CN copy when Zotero is running in Chinese", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
      },
    });

    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [],
      scope: null,
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.locationLabel).toBe("文献库");
    expect(model.heroTitle).toBe("选择条目");
    expect(model.composerPlaceholder).toBe("选择一篇论文后开始提问。");
    expect(model.statusLabel).toBe("等待上下文");
  });

  it("surfaces Chinese suggested action labels from the shared command catalog", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
      },
    });

    const model = buildSidebarViewModel({
      location: "library",
      recentThreads: [],
      scope: makeScope(),
      session: makeSession(),
      settings: makeSettings(),
      settingsIssue: null,
    });

    expect(model.suggestedActions.map((action) => action.label)).toEqual(
      expect.arrayContaining(["总结论文", "通俗解释", "核心贡献"]),
    );
  });
});
