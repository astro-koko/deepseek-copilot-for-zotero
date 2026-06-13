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
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "",
      metadata: "Test metadata",
      selectedText: "",
      warnings: [],
    });
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
          content: expect.stringContaining("你是 Deepseek Copliot"),
        }),
        {
          role: "user",
          content: "Summarize this paper",
        },
      ],
      undefined,
      expect.objectContaining({
        fullTextChars: 0,
        systemPromptChars: expect.any(Number),
      }),
    );
  });

  it("includes context availability warnings in the system prompt when full text is unavailable", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "fulltext-required-error",
      blockingMessage: "当前论文全文不可用，无法发送请求。",
      fullText: "",
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });

    await expect(
      sendChatMessage(makeThread([]), {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      }),
    ).rejects.toThrow("当前论文全文不可用，无法发送请求。");
    expect(providerMocks.sendChat).not.toHaveBeenCalled();
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
      fullText:
        "Introduction text.\nPage 5\nCode Availability\nThe SHARP template is available at https://github.com/stanford-ai4physics/sharp.",
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
    expect(messages[0].content).toContain("Introduction text.");
    expect(messages[0].content).toContain("Code Availability");
    expect(messages[0].content).toContain("stanford-ai4physics/sharp");
  });

  it("adds a document-tail helper section while still sending the full paper text", async () => {
    const bodyPrefix = "Introduction text.\n" + "Background paragraph.\n".repeat(220);
    const tailSection =
      "Figure A7. Diffusion guidance with self-recurrence.\n" +
      "Figure A8. General guidance for the Two Moons task.\n";
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: `${bodyPrefix}${tailSection}`,
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });

    await sendChatMessage(
      makeThread([
        {
          id: "msg-1",
          role: "user",
          content: "这篇论文最后一页讲了什么？",
          timestamp: 1,
        },
      ]),
      {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("=== 正文内容 ===");
    expect(messages[0].content).toContain("Introduction text.");
    expect(messages[0].content).toContain("=== 文档末尾重点 ===");
    expect(messages[0].content).toContain("Figure A7");
    expect(messages[0].content).toContain("Figure A8");
  });

  it("propagates an unsupported-scope blocking message before calling the provider", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "fulltext-unsupported-scope",
      blockingMessage: "当前仅支持单篇论文或当前 PDF 的全文模式。",
      fullText: "",
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });

    await expect(
      sendChatMessage(makeThread([]), {
        type: "collection",
        id: "collection-1",
        label: "Collection 1",
        itemIds: [1, 2],
      }),
    ).rejects.toThrow("当前仅支持单篇论文或当前 PDF 的全文模式。");
    expect(providerMocks.sendChat).not.toHaveBeenCalled();
  });

  it("translates provider context-limit errors into a clearer Chinese message", async () => {
    providerMocks.sendChat.mockRejectedValue(
      new Error("Provider error 400: context_length_exceeded"),
    );

    await expect(
      sendChatMessage(
        makeThread([
          {
            id: "msg-1",
            role: "user",
            content: "Summarize this paper",
            timestamp: 1,
          },
        ]),
        {
          type: "paper",
          id: "paper-1",
          label: "Paper 1",
          itemIds: [1],
        },
      ),
    ).rejects.toThrow("当前论文全文超出模型上下文上限，请更换模型或缩小范围。");
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
