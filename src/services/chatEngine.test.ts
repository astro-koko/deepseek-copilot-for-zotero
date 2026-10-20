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

    expect(
      estimateTextTokens(largePaper + oldDialogue + oldDialogue),
    ).toBeGreaterThan(CONTEXT_COMPRESSION_THRESHOLD_TOKENS);
    expect(providerMocks.sendChat).toHaveBeenCalledTimes(2);
    expect(providerMocks.sendChat.mock.calls[0]?.[3]).toEqual({
      maxTokens: 2_000,
      temperature: 0.2,
    });
    const mainMessages = providerMocks.sendChat.mock.calls[1]?.[0];
    expect(mainMessages?.[0].content).toContain(largePaper.slice(0, 40));
    expect(
      mainMessages?.some((message: { content: string }) =>
        message.content.includes("压缩后的早期对话摘要"),
      ),
    ).toBe(true);
    expect(
      mainMessages?.some((message: { content: string }) =>
        message.content.includes(oldDialogue.slice(0, 80)),
      ),
    ).toBe(false);
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
    expect(result.evidenceAuditMessage).toBe(
      "联网搜索：DeepSeek · 独立文献 1 条",
    );
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
      "联网搜索失败：Tavily unavailable，本轮未获得联网证据",
    );
  });

  it("tells the model when a requested search failed instead of silently omitting search status", async () => {
    providerMocks.searchEvidence.mockRejectedValue(
      new Error("Search timed out"),
    );

    await sendChatMessage(
      makeThread([
        {
          id: "q",
          role: "user",
          content: "请联网找 arXiv 论文并给出编号",
          timestamp: 1,
        },
      ]),
      undefined,
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("=== 本轮联网搜索状态 ===");
    expect(messages[0].content).toContain("搜索失败");
    expect(messages[0].content).toContain("不要编造");
  });

  it("distinguishes a completed search with zero results from unavailable networking", async () => {
    // 决策调用回答"足够"→ 保持零结果状态注入主请求。
    providerMocks.searchEvidence.mockResolvedValue({ items: [] });
    providerMocks.sendChat.mockResolvedValueOnce({
      abort: vi.fn(),
      stream: (async function* zeroRefineDecline() {
        yield "足够";
      })(),
    });

    await sendChatMessage(makeThread([]), undefined, { evidenceEnabled: true });

    const [messages] = providerMocks.sendChat.mock.calls.at(-1) || [];
    expect(messages[0].content).toContain("=== 本轮联网搜索状态 ===");
    expect(messages[0].content).toContain("未找到可用结果");
    expect(messages[0].content).toContain("不要编造");
  });

  it("explains that successful host retrieval is available even without model browsing tools", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Verified arXiv result",
          url: "https://arxiv.org/abs/1234.56789",
          snippet: "A source returned by the plugin, not model memory.",
        },
      ],
    });

    await sendChatMessage(
      makeThread([
        {
          id: "old",
          role: "assistant",
          content: "我无法在当前会话中真正联网检索 arXiv",
          timestamp: 1,
        },
        { id: "q", role: "user", content: "联网再查一次", timestamp: 2 },
      ]),
      undefined,
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("=== 本轮联网搜索状态 ===");
    expect(messages[0].content).toContain("插件已完成真实联网检索");
    expect(messages[0].content).toContain("历史回答");
    expect(messages[0].content).toContain("不要编造");
  });

  it("assembles context before searching so the current paper identity reaches the search", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "pdf-text-ready",
      fullText: "Full text",
      metadata: "Metadata",
      selectedText: "",
      warnings: [],
      currentPaper: {
        title: "Identity Paper",
        dois: ["10.1234/identity"],
        arxivIds: [],
      },
    });
    providerMocks.searchEvidence.mockResolvedValue({ items: [] });

    await sendChatMessage(
      makeThread([
        { id: "q", role: "user", content: "相关工作有哪些", timestamp: 1 },
      ]),
      { type: "paper", id: "paper-1", label: "Identity Paper", itemIds: [1] },
      { evidenceEnabled: true },
    );

    expect(providerMocks.searchEvidence).toHaveBeenCalledWith(
      "相关工作有哪些",
      expect.objectContaining({ label: "Identity Paper" }),
      {
        currentPaper: {
          title: "Identity Paper",
          dois: ["10.1234/identity"],
          arxivIds: [],
        },
        paperFullText: "Full text",
        priorQuestion: undefined,
      },
    );
    const order = [
      providerMocks.assembleContext.mock.invocationCallOrder[0],
      providerMocks.searchEvidence.mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it("skips the search entirely when the document context is blocking", async () => {
    providerMocks.assembleContext.mockReturnValue({
      availability: "fulltext-required-error",
      blockingMessage: "当前论文全文不可用，无法发送请求。",
      fullText: "",
      metadata: "",
      selectedText: "",
      warnings: [],
    });

    await expect(
      sendChatMessage(
        makeThread([
          { id: "q", role: "user", content: "相关工作", timestamp: 1 },
        ]),
        { type: "paper", id: "paper-1", label: "Paper 1", itemIds: [1] },
        { evidenceEnabled: true },
      ),
    ).rejects.toThrow("当前论文全文不可用");
    expect(providerMocks.searchEvidence).not.toHaveBeenCalled();
  });

  it("renders folded main-paper entries separately from independent works", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Independent related survey",
          url: "https://example.org/survey",
          snippet: "Independent survey content",
          summary: "Independent survey content",
        },
      ],
      mainPaperItems: [
        {
          title: "The current paper - Journal Article",
          url: "https://catalog.example.org/current",
          snippet: "",
        },
      ],
      plan: {
        intent: "related-work",
        queries: [
          {
            status: "success",
            resultCount: 2,
            queryChars: 100,
            durationMs: 200,
          },
        ],
      },
    });

    const result = await sendChatMessage(
      makeThread([
        { id: "q", role: "user", content: "相关工作", timestamp: 1 },
      ]),
      { type: "paper", id: "paper-1", label: "Paper 1", itemIds: [1] },
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("--- 独立相关文献（1 条）---");
    expect(messages[0].content).toContain(
      "--- 当前论文自身条目（1 条，已折叠）---",
    );
    expect(messages[0].content).toContain("不是独立文献");
    expect(messages[0].content).toContain("本轮检索意图：related-work");
    expect(result.evidenceAuditMessage).toBe(
      "联网搜索：DeepSeek · 意图 related-work · 独立文献 1 条 · 主论文条目 1 条（已折叠）",
    );
  });

  it("runs a second model-guided search when the first pass looks incomplete", async () => {
    // 首段：零相关（空）→ 模型提出补充查询 → 第二段搜到新工作。
    providerMocks.searchEvidence
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        items: [
          {
            title: "Second pass hit",
            url: "https://example.org/second-pass",
            snippet: "",
            summary: "Refined follow-up result.",
          },
        ],
        plan: {
          intent: "related-work",
          queries: [
            {
              status: "success",
              resultCount: 3,
              queryChars: 60,
              durationMs: 200,
            },
            {
              status: "success",
              resultCount: 2,
              queryChars: 40,
              durationMs: 200,
            },
          ],
        },
      });
    providerMocks.sendChat.mockResolvedValueOnce({
      abort: vi.fn(),
      stream: (async function* () {
        yield "ALT_QUERY: WALLABY DR2 confusion mass function";
      })(),
    });

    const result = await sendChatMessage(
      makeThread([
        { id: "q", role: "user", content: "相关工作有哪些", timestamp: 1 },
      ]),
      { type: "paper", id: "paper-1", label: "HI Paper", itemIds: [1] },
      { evidenceEnabled: true },
    );

    expect(providerMocks.searchEvidence).toHaveBeenCalledTimes(2);
    // 第二次搜索收到了模型提炼的补充查询。
    const allSearchCalls = providerMocks.searchEvidence.mock
      .calls as unknown as Array<[string, unknown, { extraQuery?: string }]>;
    expect(allSearchCalls.at(-1)?.[2]).toEqual(
      expect.objectContaining({
        extraQuery: "WALLABY DR2 confusion mass function",
      }),
    );
    const [messages] = providerMocks.sendChat.mock.calls.at(-1) || [];
    expect(messages[0].content).toContain("Second pass hit");
    expect(result.evidenceAuditMessage).toContain("补充检索");
  });

  it("keeps the single-pass flow when the first pass already has evidence", async () => {
    providerMocks.searchEvidence.mockResolvedValueOnce({
      items: [
        {
          title: "Good first pass",
          url: "https://example.org/first-pass",
          snippet: "",
          summary: "First pass result.",
        },
      ],
    });

    await sendChatMessage(
      makeThread([
        { id: "q", role: "user", content: "相关工作有哪些", timestamp: 1 },
      ]),
      { type: "paper", id: "paper-1", label: "HI Paper", itemIds: [1] },
      { evidenceEnabled: true },
    );

    // 已有可用证据时不额外发起决策/补搜。
    expect(providerMocks.searchEvidence).toHaveBeenCalledTimes(1);
    expect(providerMocks.sendChat).toHaveBeenCalledTimes(1);
  });

  it("falls back to the first-pass evidence when the zero-result refine declines", async () => {
    providerMocks.searchEvidence.mockResolvedValueOnce({ items: [] });
    // 决策调用回答"足够"（无 ALT_QUERY）→ 不二搜。
    providerMocks.sendChat.mockResolvedValueOnce({
      abort: vi.fn(),
      stream: (async function* () {
        yield "足够";
      })(),
    });

    const result = await sendChatMessage(
      makeThread([
        { id: "q", role: "user", content: "相关工作有哪些", timestamp: 1 },
      ]),
      { type: "paper", id: "paper-1", label: "HI Paper", itemIds: [1] },
      { evidenceEnabled: true },
    );

    expect(providerMocks.searchEvidence).toHaveBeenCalledTimes(1);
    expect(providerMocks.sendChat).toHaveBeenCalledTimes(2);
    const [messages] = providerMocks.sendChat.mock.calls.at(-1) || [];
    expect(messages[0].content).toContain("=== 本轮联网搜索状态 ===");
    expect(result.evidenceAuditMessage).not.toContain("补充检索");
  });

  it("injects the model-facing summary in preference to raw page content", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Summarized work",
          url: "https://example.org/work",
          snippet: "",
          summary: "Concise model-facing summary.",
          content: "Raw page body that would waste context.",
        },
      ],
    });

    await sendChatMessage(
      makeThread([{ id: "q", role: "user", content: "背景", timestamp: 1 }]),
      { type: "paper", id: "paper-1", label: "Paper 1", itemIds: [1] },
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    expect(messages[0].content).toContain("Concise model-facing summary.");
    expect(messages[0].content).not.toContain("Raw page body");
  });

  it("caps each injected evidence item to a bounded character budget", async () => {
    providerMocks.searchEvidence.mockResolvedValue({
      items: [
        {
          title: "Huge summary work",
          url: "https://example.org/huge",
          snippet: "",
          summary: "长".repeat(5000),
        },
      ],
    });

    await sendChatMessage(
      makeThread([{ id: "q", role: "user", content: "背景", timestamp: 1 }]),
      { type: "paper", id: "paper-1", label: "Paper 1", itemIds: [1] },
      { evidenceEnabled: true },
    );

    const [messages] = providerMocks.sendChat.mock.calls[0] || [];
    const content = messages[0].content as string;
    const injected = content.split("内容：")[1]?.split("\n")[0] || "";
    expect(Array.from(injected).length).toBeLessThanOrEqual(800);
  });
});
