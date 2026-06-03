import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Thread } from "../types/thread";
import type { AssembledContext } from "./contextAssembler";
import type { EvidenceSearchResult } from "./evidenceSearch";

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
    evidenceEnabled: false,
    evidenceProviderMode: "builtin-search",
    tavilyApiKey: "",
  }));
  const searchEvidence = vi.fn<() => Promise<EvidenceSearchResult>>(
    async () => ({
      providerLabel: "OpenAlex",
      items: [],
    }),
  );

  return {
    assembleContext,
    createOpenAICompatibleProvider,
    getSettings,
    searchEvidence,
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

vi.mock("./evidenceSearch", () => ({
  searchEvidence: providerMocks.searchEvidence,
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
    providerMocks.searchEvidence.mockClear();
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
      evidenceEnabled: false,
      evidenceProviderMode: "builtin-search",
      tavilyApiKey: "",
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

  it("injects external evidence into the system prompt when evidence search is enabled", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      providerLabel: "OpenAlex",
      items: [
        {
          title: "Retrieval-Augmented Generation for Large Language Models",
          authors: ["Jane Doe", "John Roe"],
          year: "2024",
          source: "OpenAlex",
          url: "https://example.com/rag",
          snippet: "RAG improves factual grounding when paired with citation-aware retrieval.",
        },
      ],
    });

    const result = await sendChatMessage(
      makeThread([]),
      {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      },
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("EXTERNAL EVIDENCE");
    expect(messages[0].content).toContain("[E1]");
    expect(messages[0].content).toContain("RAG improves factual grounding");
    expect(result.evidenceAuditMessage).toBe("联网查证：OpenAlex · 1 条结果");
  });

  it("continues without external evidence when evidence search fails", async () => {
    providerMocks.searchEvidence.mockRejectedValue(new Error("Tavily unavailable"));

    const result = await sendChatMessage(
      makeThread([]),
      {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      },
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).not.toContain("EXTERNAL EVIDENCE");
    expect(result.evidenceAuditMessage).toBe(
      "联网查证失败：Tavily unavailable，本轮仅基于当前论文回答",
    );
  });
});
