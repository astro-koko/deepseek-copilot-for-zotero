import { describe, expect, it, vi } from "vitest";

import type { ScopeContext } from "../types/scope";
import type { Thread } from "../types/thread";
import { createChatSessionStore } from "./chatSession";

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    title: "New Conversation",
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    ...overrides,
  };
}

function makeScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    type: "paper",
    id: "paper-1",
    scopeKey: "paper-1",
    label: "Paper 1",
    itemIds: [1],
    ...overrides,
  };
}

async function* streamChunks(...chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function* streamReasoningThenContent() {
  yield { type: "reasoning_delta" as const, content: "Checking context. " };
  yield "Final answer.";
}

describe("chatSession", () => {
  it("sends successfully when AbortController is unavailable in the host runtime", async () => {
    const originalAbortController = (globalThis as any).AbortController;
    (globalThis as any).AbortController = undefined;

    try {
      const scope = makeScope();
      const emptyThread = makeThread({ scopeSnapshot: scope });
      const threadWithUser = makeThread({
        scopeSnapshot: scope,
        messages: [
          {
            id: "msg-user-1",
            role: "user",
            content: "Host fallback",
            timestamp: 2,
          },
        ],
        updatedAt: 2,
      });
      const finalThread = makeThread({
        scopeSnapshot: scope,
        messages: [
          ...threadWithUser.messages,
          {
            id: "msg-assistant-1",
            role: "assistant",
            content: "Fallback works.",
            timestamp: 3,
          },
        ],
        updatedAt: 3,
      });

      const createThread = vi.fn().mockResolvedValue(emptyThread);
      const appendMessage = vi
        .fn()
        .mockResolvedValueOnce(threadWithUser)
        .mockResolvedValueOnce(finalThread);
      const sendChatMessage = vi.fn().mockResolvedValue({
        abort: vi.fn(),
        stream: streamChunks("Fallback works."),
      });

      const store = createChatSessionStore({
        appendMessage,
        createThread,
        recordScopeTransition: vi.fn(),
        sendChatMessage,
      });

      await store.send("Host fallback", scope);

      expect(sendChatMessage).toHaveBeenCalledWith(
        threadWithUser,
        scope,
        undefined,
        undefined,
      );
      expect(store.getSnapshot().activeThread).toEqual(finalThread);
      expect(store.getSnapshot().error).toBeNull();
    } finally {
      (globalThis as any).AbortController = originalAbortController;
    }
  });

  it("surfaces streaming status and provider reasoning before persisting the final answer", async () => {
    const scope = makeScope();
    const emptyThread = makeThread({ scopeSnapshot: scope });
    const threadWithUser = makeThread({
      scopeSnapshot: scope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "Explain",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const finalThread = makeThread({
      scopeSnapshot: scope,
      messages: [
        ...threadWithUser.messages,
        {
          id: "msg-assistant-1",
          role: "assistant",
          content: "Final answer.",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });
    const createThread = vi.fn().mockResolvedValue(emptyThread);
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(threadWithUser)
      .mockResolvedValueOnce(finalThread);
    const sendChatMessage = vi.fn().mockResolvedValue({
      abort: vi.fn(),
      stream: streamReasoningThenContent(),
    });
    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });
    const snapshots: ReturnType<typeof store.getSnapshot>[] = [];
    store.subscribe(() => {
      snapshots.push(store.getSnapshot());
    });

    await store.send("Explain", scope);

    expect(snapshots.map((snapshot) => snapshot.streamingStatus)).toContain(
      "preparing",
    );
    expect(snapshots.map((snapshot) => snapshot.streamingStatus)).toContain(
      "reasoning",
    );
    expect(
      snapshots.map((snapshot) => snapshot.streamingReasoningContent),
    ).toContain("Checking context. ");
    expect(snapshots.map((snapshot) => snapshot.streamingContent)).toContain(
      "Final answer.",
    );
    expect(store.getSnapshot()).toMatchObject({
      activeThread: finalThread,
      isStreaming: false,
      streamingContent: "",
      streamingReasoningContent: "",
      streamingStatus: "idle",
    });
  });

  it("clears an active thread when syncing to a different document scope", async () => {
    const initialScope = makeScope();
    const nextScope = makeScope({
      id: "pdf-1",
      scopeKey: "pdf-1",
      label: "Current PDF",
      type: "pdf",
      readerAttachmentId: 99,
    });
    const initialThread = makeThread({
      scopeKey: "paper-1",
      scopeSnapshot: initialScope,
    });
    const recordScopeTransition = vi.fn();

    const store = createChatSessionStore({
      appendMessage: vi.fn(),
      createThread: vi.fn().mockResolvedValue(initialThread),
      recordScopeTransition,
      sendChatMessage: vi.fn(),
    });

    await store.newThread(initialScope);
    await store.syncScope(nextScope);

    expect(recordScopeTransition).not.toHaveBeenCalled();
    expect(store.getSnapshot().activeThread).toBeNull();
  });

  it("creates a new current-scope thread instead of appending to another document's active thread", async () => {
    const pdfAScope = makeScope({
      id: "pdf-10",
      scopeKey: "pdf-10",
      label: "PDF A",
      type: "pdf",
      itemIds: [9],
      readerAttachmentId: 10,
    });
    const pdfBScope = makeScope({
      id: "pdf-20",
      scopeKey: "pdf-20",
      label: "PDF B",
      type: "pdf",
      itemIds: [19],
      readerAttachmentId: 20,
    });
    const pdfAThread = makeThread({
      id: "thread-pdf-a",
      scopeKey: "pdf-10",
      scopeSnapshot: pdfAScope,
      messages: [
        {
          id: "msg-a",
          role: "user",
          content: "PDF A question",
          timestamp: 1,
        },
      ],
    });
    const pdfBEmptyThread = makeThread({
      id: "thread-pdf-b",
      scopeKey: "pdf-20",
      scopeSnapshot: pdfBScope,
    });
    const pdfBThreadWithUser = makeThread({
      ...pdfBEmptyThread,
      messages: [
        {
          id: "msg-b-user",
          role: "user",
          content: "Question for PDF B",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const pdfBFinalThread = makeThread({
      ...pdfBThreadWithUser,
      messages: [
        ...pdfBThreadWithUser.messages,
        {
          id: "msg-b-assistant",
          role: "assistant",
          content: "PDF B answer.",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });
    const createThread = vi.fn().mockResolvedValue(pdfBEmptyThread);
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(pdfBThreadWithUser)
      .mockResolvedValueOnce(pdfBFinalThread);
    const recordScopeTransition = vi.fn();
    const sendChatMessage = vi.fn().mockResolvedValue({
      abort: vi.fn(),
      stream: streamChunks("PDF B answer."),
    });

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition,
      sendChatMessage,
    });

    store.openThread(pdfAThread);
    await store.send("Question for PDF B", pdfBScope);

    expect(recordScopeTransition).not.toHaveBeenCalled();
    expect(createThread).toHaveBeenCalledWith(pdfBScope);
    expect(appendMessage).toHaveBeenNthCalledWith(1, "thread-pdf-b", {
      role: "user",
      content: "Question for PDF B",
    });
    expect(appendMessage).not.toHaveBeenCalledWith(
      "thread-pdf-a",
      expect.anything(),
    );
    expect(sendChatMessage).toHaveBeenCalledWith(
      pdfBThreadWithUser,
      pdfBScope,
      undefined,
      expect.any(AbortSignal),
    );
    expect(store.getSnapshot().activeThread).toEqual(pdfBFinalThread);
  });

  it("creates a thread and sends the very first message in one action", async () => {
    const scope = makeScope();
    const emptyThread = makeThread({ scopeSnapshot: scope });
    const threadWithUser = makeThread({
      scopeSnapshot: scope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "Summarize this paper",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const finalThread = makeThread({
      scopeSnapshot: scope,
      messages: [
        ...threadWithUser.messages,
        {
          id: "msg-assistant-1",
          role: "assistant",
          content: "Here is a summary.",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });

    const createThread = vi.fn().mockResolvedValue(emptyThread);
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(threadWithUser)
      .mockResolvedValueOnce(finalThread);
    const sendChatMessage = vi.fn().mockResolvedValue({
      abort: vi.fn(),
      stream: streamChunks("Here is ", "a summary."),
    });

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    await store.send("Summarize this paper", scope);

    expect(createThread).toHaveBeenCalledWith(scope);
    expect(appendMessage).toHaveBeenNthCalledWith(1, emptyThread.id, {
      role: "user",
      content: "Summarize this paper",
    });
    expect(sendChatMessage).toHaveBeenCalledWith(
      threadWithUser,
      scope,
      undefined,
      expect.any(AbortSignal),
    );
    expect(appendMessage).toHaveBeenNthCalledWith(2, emptyThread.id, {
      role: "assistant",
      content: "Here is a summary.",
    });
    expect(store.getSnapshot().activeThread).toEqual(finalThread);
    expect(store.getSnapshot().isStreaming).toBe(false);
    expect(store.getSnapshot().streamingContent).toBe("");
  });

  it("persists an evidence audit system message before the assistant reply when evidence mode is enabled", async () => {
    const scope = makeScope();
    const emptyThread = makeThread({ scopeSnapshot: scope });
    const threadWithUser = makeThread({
      scopeSnapshot: scope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "查证这篇论文的结论",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const threadWithAudit = makeThread({
      scopeSnapshot: scope,
      messages: [
        ...threadWithUser.messages,
        {
          id: "msg-system-1",
          role: "system",
          content: "联网查证：Tavily · 3 条结果",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });
    const finalThread = makeThread({
      scopeSnapshot: scope,
      messages: [
        ...threadWithAudit.messages,
        {
          id: "msg-assistant-1",
          role: "assistant",
          content: "Here is a verified answer.",
          timestamp: 4,
        },
      ],
      updatedAt: 4,
    });

    const createThread = vi.fn().mockResolvedValue(emptyThread);
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(threadWithUser)
      .mockResolvedValueOnce(threadWithAudit)
      .mockResolvedValueOnce(finalThread);
    const sendChatMessage = vi.fn().mockResolvedValue({
      abort: vi.fn(),
      evidenceAuditMessage: "联网查证：Tavily · 3 条结果",
      stream: streamChunks("Here is a verified answer."),
    });

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    await store.send("查证这篇论文的结论", scope, { evidenceEnabled: true });

    expect(sendChatMessage).toHaveBeenCalledWith(
      threadWithUser,
      scope,
      { evidenceEnabled: true },
      expect.any(AbortSignal),
    );
    expect(appendMessage).toHaveBeenNthCalledWith(2, emptyThread.id, {
      role: "system",
      content: "联网查证：Tavily · 3 条结果",
    });
    expect(appendMessage).toHaveBeenNthCalledWith(3, emptyThread.id, {
      role: "assistant",
      content: "Here is a verified answer.",
    });
  });

  it("does not let an aborted request restore the old thread after starting a new one", async () => {
    const firstScope = makeScope();
    const secondScope = makeScope({
      id: "paper-2",
      itemIds: [2],
      label: "Paper 2",
    });
    const firstThread = makeThread({ scopeSnapshot: firstScope });
    const firstThreadWithUser = makeThread({
      scopeSnapshot: firstScope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "Explain this section",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const abortedThread = makeThread({
      scopeSnapshot: firstScope,
      messages: [
        ...firstThreadWithUser.messages,
        {
          id: "msg-assistant-err",
          role: "assistant",
          content: "Error: aborted",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });
    const secondThread = makeThread({
      id: "thread-2",
      scopeSnapshot: secondScope,
    });

    const createThread = vi
      .fn()
      .mockResolvedValueOnce(firstThread)
      .mockResolvedValueOnce(secondThread);
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(firstThreadWithUser)
      .mockResolvedValueOnce(abortedThread);
    const sendChatMessage = vi.fn(
      async (
        _thread: Thread,
        _scope: ScopeContext | undefined,
        _requestOptions: unknown,
        signal?: AbortSignal,
      ) =>
        new Promise<{ abort: () => void; stream: AsyncIterable<string> }>(
          (_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          },
        ),
    );

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    const firstSend = store.send("Explain this section", firstScope);
    await vi.waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledTimes(1);
    });

    await store.newThread(secondScope);
    await firstSend;

    expect(store.getSnapshot().activeThread).toEqual(secondThread);
    expect(store.getSnapshot().isStreaming).toBe(false);
  });

  it("stops streaming without appending an abort error message", async () => {
    const scope = makeScope();
    const emptyThread = makeThread({ scopeSnapshot: scope });
    const threadWithUser = makeThread({
      scopeSnapshot: scope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "Stop this response",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });

    const createThread = vi.fn().mockResolvedValue(emptyThread);
    const appendMessage = vi.fn().mockResolvedValue(threadWithUser);
    const sendChatMessage = vi.fn(
      async (
        _thread: Thread,
        _scope: ScopeContext | undefined,
        _requestOptions: unknown,
        signal?: AbortSignal,
      ) =>
        new Promise<{ abort: () => void; stream: AsyncIterable<string> }>(
          (_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          },
        ),
    );

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    const sendPromise = store.send("Stop this response", scope);
    await vi.waitFor(() => {
      expect(sendChatMessage).toHaveBeenCalledTimes(1);
    });

    store.cancel();
    await sendPromise;

    expect(appendMessage).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().activeThread).toEqual(threadWithUser);
    expect(store.getSnapshot().error).toBeNull();
    expect(store.getSnapshot().isStreaming).toBe(false);
  });

  it("reuses the current thread when sending another message in the same supported scope", async () => {
    const scope = makeScope();
    const activeThread = makeThread({
      scopeSnapshot: scope,
      messages: [
        {
          id: "msg-user-1",
          role: "user",
          content: "First question",
          timestamp: 1,
        },
        {
          id: "msg-assistant-1",
          role: "assistant",
          content: "First answer",
          timestamp: 2,
        },
      ],
      updatedAt: 2,
    });
    const threadWithFollowup = makeThread({
      ...activeThread,
      messages: [
        ...activeThread.messages,
        {
          id: "msg-user-2",
          role: "user",
          content: "Explain this excerpt",
          timestamp: 3,
        },
      ],
      updatedAt: 3,
    });
    const finalThread = makeThread({
      ...threadWithFollowup,
      messages: [
        ...threadWithFollowup.messages,
        {
          id: "msg-assistant-2",
          role: "assistant",
          content: "Here is the explanation.",
          timestamp: 4,
        },
      ],
      updatedAt: 4,
    });

    const createThread = vi.fn();
    const appendMessage = vi
      .fn()
      .mockResolvedValueOnce(threadWithFollowup)
      .mockResolvedValueOnce(finalThread);
    const sendChatMessage = vi.fn().mockResolvedValue({
      abort: vi.fn(),
      stream: streamChunks("Here is ", "the explanation."),
    });

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    store.openThread(activeThread);
    await store.send("Explain this excerpt", scope);

    expect(createThread).not.toHaveBeenCalled();
    expect(sendChatMessage).toHaveBeenCalledWith(
      threadWithFollowup,
      scope,
      undefined,
      expect.any(AbortSignal),
    );
    expect(store.getSnapshot().activeThread).toEqual(finalThread);
  });

  it("surfaces a first-message persistence failure without entering a fake streaming state", async () => {
    const scope = makeScope();
    const emptyThread = makeThread({ scopeSnapshot: scope });
    const createThread = vi.fn().mockResolvedValue(emptyThread);
    const appendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed to save user message"));
    const sendChatMessage = vi.fn();

    const store = createChatSessionStore({
      appendMessage,
      createThread,
      recordScopeTransition: vi.fn(),
      sendChatMessage,
    });

    await expect(
      store.send("Explain this excerpt", scope),
    ).resolves.toBeUndefined();

    expect(sendChatMessage).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toMatchObject({
      activeThread: emptyThread,
      error: "Failed to save user message",
      isStreaming: false,
      streamingContent: "",
    });
  });
});
