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
    expect(model.heroTitle).toContain("Select");
    expect(model.composerDisabled).toBe(true);
    expect(model.showShell).toBe(true);
    expect(model.showSuggestedActions).toBe(false);
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
});
