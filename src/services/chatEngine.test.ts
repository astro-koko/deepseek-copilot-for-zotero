import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Thread } from "../types/thread";
import type { AssembledContext } from "./contextAssembler";

const providerMocks = vi.hoisted(() => {
  const sendChat = vi.fn();
  const createOpenAICompatibleProvider = vi.fn(() => ({ sendChat }));
  const assembleContext = vi.fn<() => AssembledContext>(() => ({
    availability: "pdf-text-ready",
    fullText: "",
    metadata: "Test metadata",
    selectedText: "",
    warnings: [],
  }));
  const getSettings = vi.fn(() => ({
    apiKey: "sk-test",
    baseURL: "https://api.deepseek.com",
    keyboardShortcut: "I",
    maxContextBudget: 4000,
    model: "deepseek-v4-flash",
  }));

  return {
    assembleContext,
    createOpenAICompatibleProvider,
    getSettings,
    sendChat,
  };
});

vi.mock("./provider/openAICompatibleProvider", () => ({
  createOpenAICompatibleProvider: providerMocks.createOpenAICompatibleProvider,
}));

vi.mock("./contextAssembler", () => ({
  assembleContext: providerMocks.assembleContext,
}));

vi.mock("./settingsManager", () => ({
  getSettings: providerMocks.getSettings,
}));

import { sendChatMessage } from "./chatEngine";

function makeThread(messages: Thread["messages"]): Thread {
  return {
    id: "thread-1",
    title: "Conversation",
    createdAt: 1,
    updatedAt: 1,
    messages,
  };
}

describe("chatEngine", () => {
  beforeEach(() => {
    providerMocks.createOpenAICompatibleProvider.mockClear();
    providerMocks.assembleContext.mockClear();
    providerMocks.getSettings.mockClear();
    providerMocks.sendChat.mockReset();
    providerMocks.sendChat.mockResolvedValue({
      abort: vi.fn(),
      stream: (async function* emptyStream() {})(),
    });
  });

  it("sends the persisted thread history without duplicating the latest user message", async () => {
    const persistedThread = makeThread([
      {
        id: "msg-1",
        role: "user",
        content: "Summarize this paper",
        timestamp: 1,
      },
    ]);

    await sendChatMessage(persistedThread, undefined);

    expect(providerMocks.sendChat).toHaveBeenCalledWith(
      [
        expect.objectContaining({ role: "system" }),
        {
          role: "user",
          content: "Summarize this paper",
        },
      ],
      undefined,
    );
  });

  it("includes context availability warnings in the system prompt when full text is unavailable", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "abstract-only",
      fullText: "Abstract text",
      metadata: "Metadata block",
      selectedText: "",
      warnings: [
        "Using the abstract because no extractable PDF text is available for this scope.",
      ],
    });

    await sendChatMessage(makeThread([]), {
      type: "paper",
      id: "paper-1",
      label: "Paper 1",
      itemIds: [1],
    });

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("CONTEXT STATUS");
    expect(messages[0].content).toContain("abstract-only");
    expect(messages[0].content).toContain(
      "Using the abstract because no extractable PDF text is available for this scope.",
    );
  });

  it("uses the persisted pro model when the sidebar switches to deep mode", async () => {
    providerMocks.getSettings.mockReturnValue({
      apiKey: "sk-test",
      baseURL: "https://api.deepseek.com",
      keyboardShortcut: "I",
      maxContextBudget: 4000,
      model: "deepseek-v4-pro",
    });

    await sendChatMessage(makeThread([]), undefined);

    expect(providerMocks.createOpenAICompatibleProvider).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
    });
  });

  it("passes later-page full text segments through the system prompt when context assembly selects them", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "Page 5\nCode Availability\nThe SHARP template is available at https://github.com/stanford-ai4physics/sharp.",
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });

    await sendChatMessage(makeThread([]), {
      type: "pdf",
      id: "pdf-1",
      label: "Paper PDF",
      itemIds: [1],
      readerAttachmentId: 11,
      readerPage: 5,
    });

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("Code Availability");
    expect(messages[0].content).toContain("stanford-ai4physics/sharp");
  });
});
