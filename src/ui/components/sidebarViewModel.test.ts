import { describe, expect, it } from "vitest";

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
    ...overrides,
  };
}

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
    expect(model.composerDisabled).toBe(true);
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
    expect(model.composerDisabled).toBe(true);
    expect(model.noticeText).toContain("API key");
    expect(model.heroTitle).toBe("Add your API key");
    expect(model.heroBody).toBe(
      "Open Settings, add your DeepSeek API key, then return here to chat in place.",
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
    expect(model.showSuggestedActions).toBe(true);
    expect(model.showRecentThreads).toBe(true);
    expect(model.composerDisabled).toBe(false);
    expect(model.heroTitle).toBe("Ready to chat");
    expect(model.heroBody).toBe(
      "Pick an action below or ask a question about the current paper.",
    );
    expect(model.providerLabel).toBe("DeepSeek Flash");
  });

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
    expect(model.showThreadView).toBe(true);
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
    expect(model.mode).toBe("empty");
    expect(model.heroTitle).toBe("Choose one paper");
    expect(model.heroBody).toBe(
      "This sidebar only chats with one paper or the active PDF right now.",
    );
    expect(model.composerDisabledReason).toBe(
      "Choose one paper in Library or open one PDF in Reader to enable chat.",
    );
    expect(model.showSuggestedActions).toBe(false);
  });

  it("maps the persisted pro model to a Deep mode provider label", () => {
    const model = buildSidebarViewModel({
      location: "reader",
      recentThreads: [],
      scope: makeScope({ type: "pdf", id: "pdf-1", readerAttachmentId: 1 }),
      session: makeSession(),
      settings: makeSettings({ model: "deepseek-v4-pro" }),
      settingsIssue: null,
    });

    expect(model.providerLabel).toBe("DeepSeek Pro");
  });
});
