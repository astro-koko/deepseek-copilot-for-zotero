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
    customPresets: "",
    keyboardShortcut: "I",
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

import {
  CONTEXT_COMPRESSION_TARGET_TOKENS,
  CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
  buildSystemPrompt,
  estimateTextTokens,
  sendChatMessage,
} from "./chatEngine";

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

  it("sends the full persisted thread history without duplicating the latest user message", async () => {
    const persistedThread = makeThread([
      {
        id: "msg-1",
        role: "user",
        content: "Summarize this paper",
        timestamp: 1,
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Earlier answer",
        timestamp: 2,
      },
      {
        id: "msg-3",
        role: "user",
        content: "Follow-up question",
        timestamp: 3,
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
        {
          role: "assistant",
          content: "Earlier answer",
        },
        {
          role: "user",
          content: "Follow-up question",
        },
      ],
      undefined,
      expect.objectContaining({
        fullTextChars: 0,
        systemPromptChars: expect.any(Number),
      }),
      { maxTokens: 16_000 },
    );
  });

  it("uses a conservative estimate for predominantly English context", () => {
    expect(estimateTextTokens("a".repeat(100))).toBe(30);
    expect(estimateTextTokens("论文")).toBe(2);
  });

  it("instructs the model to emit displayable LaTeX formulas", async () => {
    await sendChatMessage(makeThread([]), undefined);

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("$...$");
    expect(messages[0].content).toContain("$$...$$");
    expect(messages[0].content).toContain("lists, tables, or parentheses");
    expect(messages[0].content).toContain("bare parenthetical text");
    expect(messages[0].content).toContain("single LaTeX backslashes");
    expect(messages[0].content).toContain("Do not double-escape");
  });

  it("instructs the model to keep Markdown tables readable in the narrow sidebar", () => {
    const prompt = buildSystemPrompt(undefined);

    expect(prompt).toContain("窄侧栏");
    expect(prompt).toContain("最多三列");
    expect(prompt).toContain("行数不作限制");
    expect(prompt).toContain("拆成多张小表");
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
      customPresets: "",
      keyboardShortcut: "I",
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

  it("sends one complete PDF copy without duplicating a document-tail excerpt", async () => {
    const bodyPrefix =
      "Introduction text.\n" + "Background paragraph.\n".repeat(220);
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
    expect(messages[0].content).toContain("Figure A7");
    expect(messages[0].content).toContain("Figure A8");
    expect(messages[0].content).not.toContain("=== 文档末尾重点 ===");
    expect(messages[0].content.match(/Figure A7/g)).toHaveLength(1);
  });

  it("keeps the PDF as a stable prefix when later questions are appended", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "Stable full PDF text",
      metadata: "Stable metadata",
      selectedText: "A changing Reader selection",
      warnings: [],
    });
    const firstThread = makeThread([
      {
        id: "msg-1",
        role: "user",
        content: "First question",
        timestamp: 1,
      },
    ]);
    const secondThread = makeThread([
      ...firstThread.messages,
      {
        id: "msg-2",
        role: "assistant",
        content: "First answer",
        timestamp: 2,
      },
      {
        id: "msg-3",
        role: "user",
        content: "Second question",
        timestamp: 3,
      },
    ]);
    const scope = {
      type: "pdf" as const,
      id: "pdf-1",
      label: "Paper PDF",
      itemIds: [1],
      readerAttachmentId: 11,
      selectedText: "A changing Reader selection",
    };

    await sendChatMessage(firstThread, scope);
    await sendChatMessage(secondThread, scope);

    const firstMessages = providerMocks.sendChat.mock.calls[0]?.[0];
    const secondMessages = providerMocks.sendChat.mock.calls[1]?.[0];
    expect(firstMessages?.[0]).toEqual(secondMessages?.[0]);
    expect(firstMessages?.[0].content).toContain("Stable full PDF text");
    expect(firstMessages?.[0].content).not.toContain(
      "A changing Reader selection",
    );
  });

  it("compresses older dialogue at the 90 percent context line and keeps the PDF", async () => {
    const largePaper = "论文正文。".repeat(150_000);
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: largePaper,
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });
    const oldDialogue = "早期讨论。".repeat(65_000);
    const thread = makeThread([
      {
        id: "msg-old-user",
        role: "user",
        content: oldDialogue,
        timestamp: 1,
      },
      {
        id: "msg-old-assistant",
        role: "assistant",
        content: oldDialogue,
        timestamp: 2,
      },
      {
        id: "msg-recent-user",
        role: "user",
        content: "最新问题",
        timestamp: 3,
      },
    ]);
    providerMocks.sendChat
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* summaryStream() {
          yield "压缩后的早期对话摘要";
        })(),
      })
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* answerStream() {})(),
      });

    const response = await sendChatMessage(thread, {
      type: "paper",
      id: "paper-1",
      label: "Paper 1",
      itemIds: [1],
    });

    expect(estimateTextTokens(largePaper + oldDialogue + oldDialogue)).toBeGreaterThan(
      CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
    );
    expect(providerMocks.sendChat).toHaveBeenCalledTimes(2);
    expect(providerMocks.sendChat.mock.calls[0]?.[3]).toEqual({
      maxTokens: 2_000,
      temperature: 0.2,
    });
    const mainMessages = providerMocks.sendChat.mock.calls[1]?.[0];
    expect(mainMessages?.[0].content).toContain(largePaper.slice(0, 40));
    expect(mainMessages?.some((message: { content: string }) =>
      message.content.includes("压缩后的早期对话摘要"),
    )).toBe(true);
    expect(mainMessages?.some((message: { content: string }) =>
      message.content.includes(oldDialogue.slice(0, 80)),
    )).toBe(false);
    expect(response.sessionMessages).toEqual([
      expect.objectContaining({
        kind: "context-compression",
        role: "system",
        compressedThroughMessageId: "msg-old-assistant",
        contextSummary: "压缩后的早期对话摘要",
      }),
    ]);
    expect(CONTEXT_COMPRESSION_TARGET_TOKENS).toBeLessThan(
      CONTEXT_COMPRESSION_THRESHOLD_TOKENS,
    );
    expect(providerMocks.sendChat.mock.calls[1]?.[3]).toEqual({
      maxTokens: 16_000,
    });
  });

  it("searches evidence once and keeps it when dialogue compression is required", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "论文正文。".repeat(150_000),
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Evidence result",
          url: "",
          snippet: "External evidence remains available.",
        },
      ],
    });
    const oldDialogue = "早期讨论。".repeat(65_000);
    const thread = makeThread([
      {
        id: "msg-old-user",
        role: "user",
        content: oldDialogue,
        timestamp: 1,
      },
      {
        id: "msg-old-assistant",
        role: "assistant",
        content: oldDialogue,
        timestamp: 2,
      },
      {
        id: "msg-recent-user",
        role: "user",
        content: "请结合外部证据回答",
        timestamp: 3,
      },
    ]);
    providerMocks.sendChat
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* summaryStream() {
          yield "压缩后的早期对话摘要";
        })(),
      })
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* answerStream() {})(),
      });

    await sendChatMessage(
      thread,
      {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      },
      { evidenceEnabled: true },
    );

    expect(providerMocks.searchEvidence).toHaveBeenCalledTimes(1);
    const mainMessages = providerMocks.sendChat.mock.calls[1]?.[0];
    expect(mainMessages?.[0].content).toContain("=== 联网搜索结果 ===");
    expect(mainMessages?.[0].content).toContain(
      "External evidence remains available.",
    );
  });

  it("keeps recent messages when a later compression only rewrites the prior summary", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "论".repeat(820_000),
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });
    const thread = makeThread([
      {
        id: "msg-original-boundary",
        role: "assistant",
        content: "首次压缩到这里",
        timestamp: 1,
      },
      {
        id: "msg-before-marker",
        role: "user",
        content: "这条最近消息位于旧压缩标记之前，不能丢失。",
        timestamp: 2,
      },
      {
        id: "msg-old-compression",
        role: "system",
        content: "旧压缩提示",
        timestamp: 3,
        kind: "context-compression",
        compressedThroughMessageId: "msg-original-boundary",
        contextSummary: "摘".repeat(90_000),
      },
      {
        id: "msg-after-marker",
        role: "assistant",
        content: "这条最近回复也必须保留。",
        timestamp: 4,
      },
      {
        id: "msg-current-user",
        role: "user",
        content: "继续回答当前问题。",
        timestamp: 5,
      },
    ]);
    providerMocks.sendChat
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* summaryStream() {
          yield "重新整理后的摘要";
        })(),
      })
      .mockResolvedValueOnce({
        abort: vi.fn(),
        stream: (async function* answerStream() {})(),
      });

    const response = await sendChatMessage(thread, {
      type: "paper",
      id: "paper-1",
      label: "Paper 1",
      itemIds: [1],
    });

    expect(response.sessionMessages?.[0]?.compressedThroughMessageId).toBe(
      "msg-original-boundary",
    );
    const mainMessages = providerMocks.sendChat.mock.calls[1]?.[0];
    expect(mainMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: "这条最近消息位于旧压缩标记之前，不能丢失。",
        }),
        expect.objectContaining({ content: "这条最近回复也必须保留。" }),
        expect.objectContaining({ content: "继续回答当前问题。" }),
      ]),
    );
  });

  it("blocks a PDF that cannot leave safe room inside the selected model context window", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "长".repeat(995_000),
      metadata: "Metadata block",
      selectedText: "",
      warnings: [],
    });

    await expect(
      sendChatMessage(
        makeThread([
          {
            id: "msg-1",
            role: "user",
            content: "请总结",
            timestamp: 1,
          },
        ]),
        {
          type: "paper",
          id: "paper-1",
          label: "Very Long Paper",
          itemIds: [1],
        },
      ),
    ).rejects.toThrow("所选模型的上下文窗口");
    expect(providerMocks.sendChat).not.toHaveBeenCalled();
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
    ).rejects.toThrow("当前请求超出所选模型的上下文窗口，无法发送。");
  });

  it("injects external evidence into the system prompt when evidence search is enabled", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Retrieval-Augmented Generation for Large Language Models",
          url: "https://example.com/rag",
          snippet:
            "RAG improves factual grounding when paired with citation-aware retrieval.",
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
    expect(messages[0].content).toContain("=== 联网搜索结果 ===");
    expect(messages[0].content).toContain("[网页1]");
    expect(messages[0].content).toContain("RAG improves factual grounding");
    expect(result.evidenceAuditMessage).toBe("联网搜索：DeepSeek · 1 条结果");
  });

  it("continues without external evidence when evidence search fails", async () => {
    providerMocks.searchEvidence.mockRejectedValue(
      new Error("Tavily unavailable"),
    );

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
      "联网搜索失败：Tavily unavailable，本轮仅基于当前论文回答",
    );
  });
});
