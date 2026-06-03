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
    evidenceProviderMode: "mcp-web-search",
    tavilyApiKey: "",
  }));
  const searchEvidence = vi.fn<() => Promise<EvidenceSearchResult>>(
    async () => ({
      providerMode: "mcp-web-search",
      items: [],
    }),
  );
  const getEvidenceAuditLabel = vi.fn((providerMode: string) =>
    providerMode === "tavily" ? "Tavily" : "默认查证",
  );

  return {
    assembleContext,
    createOpenAICompatibleProvider,
    getEvidenceAuditLabel,
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
  getEvidenceAuditLabel: providerMocks.getEvidenceAuditLabel,
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
    providerMocks.getEvidenceAuditLabel.mockClear();
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
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("你是 DS Copilot"),
        }),
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
        "当前范围没有可提取的 PDF 正文，已自动回退到摘要内容。",
      ],
    });

    await sendChatMessage(makeThread([]), {
      type: "paper",
      id: "paper-1",
      label: "Paper 1",
      itemIds: [1],
    });

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("=== 上下文状态 ===");
    expect(messages[0].content).toContain("可用性：仅摘要");
    expect(messages[0].content).toContain(
      "当前范围没有可提取的 PDF 正文，已自动回退到摘要内容。",
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
      evidenceProviderMode: "mcp-web-search",
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
      providerMode: "mcp-web-search",
      items: [
        {
          title: "Retrieval-Augmented Generation for Large Language Models",
          authors: ["Jane Doe", "John Roe"],
          year: "2024",
          source: "Academic search",
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
    expect(messages[0].content).toContain("=== 外部证据 ===");
    expect(messages[0].content).toContain("[E1]");
    expect(messages[0].content).toContain("RAG improves factual grounding");
    expect(result.evidenceAuditMessage).toBe("联网查证：默认查证 · 1 条结果");
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
