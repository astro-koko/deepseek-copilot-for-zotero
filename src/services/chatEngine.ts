import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type {
  ChatCompletionMessage,
  StreamingResponse,
} from "./provider/types";
import { createOpenAICompatibleProvider } from "./provider/openAICompatibleProvider";
import { assembleContext, type AssembledContext } from "./contextAssembler";
import { getEvidenceAuditLabel, getSettings } from "./settingsManager";
import { searchEvidence } from "./evidenceSearch";

export interface ChatRequestOptions {
  evidenceEnabled?: boolean;
}

export const MODEL_CONTEXT_WINDOW_TOKENS = 1_000_000;
const MODEL_CONTEXT_WINDOW_TOKENS_BY_MODEL: Record<string, number> = {
  "deepseek-v4-flash": MODEL_CONTEXT_WINDOW_TOKENS,
  "deepseek-v4-pro": MODEL_CONTEXT_WINDOW_TOKENS,
};
export const CONTEXT_COMPRESSION_THRESHOLD_TOKENS = Math.floor(
  MODEL_CONTEXT_WINDOW_TOKENS * 0.9,
);
export const CONTEXT_COMPRESSION_TARGET_TOKENS = Math.floor(
  MODEL_CONTEXT_WINDOW_TOKENS * 0.85,
);
const CONTEXT_OUTPUT_RESERVE_TOKENS = 16_000;
const CONTEXT_SUMMARY_MAX_TOKENS = 2_000;
const CONTEXT_COMPRESSION_NOTICE =
  "当前会话已接近模型窗口上限，较早的交流已在本会话内自动整理为摘要；论文全文和最近对话仍会保留，较早交流中的部分细节可能被概括。";
const CONTEXT_COMPRESSION_PROMPT = `请把下面较早的论文阅读对话压缩成可供后续问答继续使用的简洁记忆。

要求：
- 保留研究问题、关键论据、术语解释、用户偏好、尚未解决的问题和重要限定。
- 不要补充原对话之外的信息。
- 删除寒暄、重复表述和已经失去后续价值的细节。
- 只输出摘要正文，不要解释压缩过程。`;

interface CompressionSessionMessage {
  role: "system";
  content: string;
  kind: "context-compression";
  compressedThroughMessageId: string;
  contextSummary: string;
}

interface PreparedEvidenceContext {
  content: string;
  auditMessage?: string;
}

type BuiltMessages = ChatCompletionMessage[] & {
  assembledContext?: AssembledContext;
  evidenceAuditMessage?: string;
};

export function buildSystemPrompt(scope: ScopeContext | undefined): string {
  const basePrompt = `你是 Deepseek Copliot，是运行在 Zotero 内的 AI 阅读助手。你的任务是帮助研究者理解论文、比较研究发现，并梳理他们的文献库。

关键规则：
- 你只能使用当前明确提供的上下文范围。
- 不要假装自己看到了当前范围之外的内容。
- 如果问题针对分类范围，请只基于当前纳入范围的条目进行综合。
- 回答要简洁但充分，必要时可以使用 Markdown。
- 输出会显示在窄侧栏的竖向对话流中。表格仅在确实有助于比较时使用，默认最多三列（包括标签列）；行数不作限制。若比较维度超过三列，拆成多张小表，或改用带小标题的分组列表，避免生成需要横向滚动或内容拥挤的宽表。
- Formula formatting: use \`$...$\` for every short inline formula, including formulas inside lists, tables, or parentheses; use \`$$...$$\` for display formulas. Never write LaTeX as bare parenthetical text like \`(A_X)\` or \`(\\varepsilon_{\\rm FG})\`; write \`$(A_X)$\` or \`$(\\varepsilon_{\\rm FG})$\` instead. Use single LaTeX backslashes in visible answers, for example \`\\epsilon\` not \`\\\\epsilon\`. Do not double-escape LaTeX commands as if writing JSON, and do not wrap formulas in code fences unless the user asks for literal source text.
- 如果问题超出了当前范围，请明确说明。`;

  if (!scope) return basePrompt;

  let scopeInfo = `\n\n当前范围：${formatScopeType(scope.type)}`;
  if (scope.label) {
    scopeInfo += ` · ${scope.label}`;
  }
  if (scope.itemIds?.length) {
    scopeInfo += `（${scope.itemIds.length} 项）`;
  }

  return basePrompt + scopeInfo;
}

export async function buildMessages(
  thread: Thread,
  scope: ScopeContext | undefined,
  requestOptions: ChatRequestOptions = {},
  preparedEvidence?: PreparedEvidenceContext,
): Promise<BuiltMessages> {
  let contextContent = "";
  let evidenceAuditMessage: string | undefined;
  let assembledContext: AssembledContext | undefined;
  if (scope) {
    assembledContext = await assembleContext(scope);
    if (assembledContext.blockingMessage) {
      throw new Error(assembledContext.blockingMessage);
    }

    contextContent =
      `\n\n=== 上下文状态 ===\n可用性：${formatAvailability(assembledContext.availability)}\n` +
      `警告：${assembledContext.warnings.length > 0 ? assembledContext.warnings.join(" | ") : "无"}`;
    contextContent += `\n\n=== 上下文 ===\n${assembledContext.metadata}`;
    if (assembledContext.fullText) {
      contextContent += `\n\n=== 正文内容 ===\n${assembledContext.fullText}`;
    }
  }

  if (requestOptions.evidenceEnabled) {
    const evidenceContext =
      preparedEvidence || (await prepareEvidenceContext(thread, scope));
    contextContent += evidenceContext.content;
    evidenceAuditMessage = evidenceContext.auditMessage;
  }

  const messages: BuiltMessages = [
    { role: "system", content: buildSystemPrompt(scope) + contextContent },
  ];

  if (assembledContext?.selectedText) {
    messages.push({
      role: "system",
      content: `=== 选中文本 ===\n${assembledContext.selectedText}`,
    });
  }

  const history = getUncompressedConversation(thread.messages);
  for (const msg of history) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  return Object.assign(messages, { assembledContext, evidenceAuditMessage });
}

export async function sendChatMessage(
  thread: Thread,
  scope: ScopeContext | undefined,
  requestOptions: ChatRequestOptions = {},
  signal?: AbortSignal,
): Promise<StreamingResponse> {
  const { baseURL, apiKey, model } = getSettings();
  const modelContextWindowTokens = getModelContextWindowTokens(model);
  const compressionThresholdTokens = Math.floor(
    modelContextWindowTokens * 0.9,
  );
  const compressionTargetTokens = Math.floor(modelContextWindowTokens * 0.85);

  if (!apiKey) {
    throw new Error("API Key 尚未配置，请先在设置中填写。");
  }

  const provider = createOpenAICompatibleProvider({ baseURL, apiKey, model });

  const preparedEvidence = requestOptions.evidenceEnabled
    ? await prepareEvidenceContext(thread, scope)
    : undefined;
  let messages = await buildMessages(
    thread,
    scope,
    requestOptions,
    preparedEvidence,
  );
  const documentTokens = estimateTextTokens(messages[0]?.content || "");
  if (
    documentTokens + CONTEXT_OUTPUT_RESERVE_TOKENS >=
    modelContextWindowTokens
  ) {
    throw new Error(
      "当前论文正文超过所选模型的上下文窗口，无法发送。",
    );
  }

  let sessionMessages: CompressionSessionMessage[] | undefined;
  const estimatedContextTokens = estimateMessagesTokens(messages);
  if (estimatedContextTokens >= compressionThresholdTokens) {
    const compression = await compressOlderDialogue(
      provider,
      thread,
      estimatedContextTokens - compressionTargetTokens,
      signal,
    );
    if (compression) {
      sessionMessages = [compression.sessionMessage];
      messages = await buildMessages(
        {
          ...thread,
          messages: [...thread.messages, toPersistedMessage(compression.sessionMessage)],
        },
        scope,
        { evidenceEnabled: Boolean(requestOptions.evidenceEnabled) },
        preparedEvidence,
      );
    }
  }

  if (
    estimateMessagesTokens(messages) + CONTEXT_OUTPUT_RESERVE_TOKENS >=
    modelContextWindowTokens
  ) {
    throw new Error(
      "当前论文和最近对话仍超过所选模型的上下文窗口，无法发送。",
    );
  }

  const systemMessage = messages[0]?.content || "";
  const assembledContext = messages.assembledContext;

  let response: StreamingResponse;
  try {
    response = await provider.sendChat(messages, signal, {
      fullTextChars: assembledContext?.fullText.length || 0,
      fullTextSource: assembledContext?.fullTextSource,
      systemPromptChars: systemMessage.length,
    }, {
      maxTokens: CONTEXT_OUTPUT_RESERVE_TOKENS,
    });
  } catch (error) {
    throw normalizeProviderError(error);
  }
  return {
    ...response,
    evidenceAuditMessage: messages.evidenceAuditMessage,
    sessionMessages,
  };
}

export function estimateTextTokens(text: string): number {
  let asciiChars = 0;
  let nonAsciiChars = 0;
  for (const character of text) {
    if (character.charCodeAt(0) <= 0x7f) {
      asciiChars += 1;
    } else {
      nonAsciiChars += 1;
    }
  }
  return Math.ceil(asciiChars * 0.3 + nonAsciiChars);
}

function getModelContextWindowTokens(model: string): number {
  return (
    MODEL_CONTEXT_WINDOW_TOKENS_BY_MODEL[model] || MODEL_CONTEXT_WINDOW_TOKENS
  );
}

function estimateMessagesTokens(messages: ChatCompletionMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateTextTokens(message.content) + 4,
    0,
  );
}

function getLatestCompressionMessage(messages: Message[]): Message | undefined {
  return [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === "system" &&
        message.kind === "context-compression" &&
        Boolean(message.contextSummary) &&
        Boolean(message.compressedThroughMessageId),
    );
}

function getUncompressedConversation(messages: Message[]): Message[] {
  const compressionMessage = getLatestCompressionMessage(messages);
  const visibleMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  if (!compressionMessage) {
    return visibleMessages;
  }

  const compressedThroughIndex = messages.findIndex(
    (message) => message.id === compressionMessage.compressedThroughMessageId,
  );
  const remaining =
    compressedThroughIndex >= 0
      ? messages.slice(compressedThroughIndex + 1).filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
      : visibleMessages;

  return [
    {
      ...compressionMessage,
      role: "assistant",
      content: `=== 较早对话摘要 ===\n${compressionMessage.contextSummary}`,
    },
    ...remaining,
  ];
}

async function compressOlderDialogue(
  provider: ReturnType<typeof createOpenAICompatibleProvider>,
  thread: Thread,
  tokensToRelease: number,
  signal?: AbortSignal,
): Promise<{ sessionMessage: CompressionSessionMessage } | null> {
  const conversation = getUncompressedConversation(thread.messages).filter(
    (message) => message.role === "user" || message.role === "assistant",
  );
  if (conversation.length <= 1) {
    return null;
  }

  const olderDialogue: Message[] = [];
  let releasedTokens = 0;
  for (const message of conversation.slice(0, -1)) {
    olderDialogue.push(message);
    releasedTokens += estimateTextTokens(message.content) + 4;
    if (releasedTokens >= Math.max(tokensToRelease, 1)) {
      break;
    }
  }
  const lastCompressedMessage = olderDialogue.at(-1);
  const compressedThroughMessageId =
    olderDialogue.length === 1 &&
    lastCompressedMessage?.kind === "context-compression"
      ? lastCompressedMessage.compressedThroughMessageId
      : lastCompressedMessage?.id;
  if (!compressedThroughMessageId) {
    return null;
  }

  const summaryResponse = await provider.sendChat(
    [
      { role: "system", content: CONTEXT_COMPRESSION_PROMPT },
      {
        role: "user",
        content: olderDialogue
          .map((message) =>
            `${message.role === "user" ? "用户" : "助手"}：${message.content}`,
          )
          .join("\n\n"),
      },
    ],
    signal,
    {
      fullTextChars: 0,
      systemPromptChars: CONTEXT_COMPRESSION_PROMPT.length,
    },
    {
      maxTokens: CONTEXT_SUMMARY_MAX_TOKENS,
      temperature: 0.2,
    },
  );
  const contextSummary = await collectTextStream(summaryResponse.stream);
  if (!contextSummary.trim()) {
    throw new Error(
      "当前会话接近模型窗口上限，但自动整理未生成有效摘要；原有会话内容未被截断，请稍后重试。",
    );
  }

  return {
    sessionMessage: {
      role: "system",
      content: CONTEXT_COMPRESSION_NOTICE,
      kind: "context-compression",
      compressedThroughMessageId,
      contextSummary: contextSummary.trim(),
    },
  };
}

async function prepareEvidenceContext(
  thread: Thread,
  scope: ScopeContext | undefined,
): Promise<PreparedEvidenceContext> {
  const lastUserMessage = [...thread.messages]
    .reverse()
    .find((message) => message.role === "user");
  const question =
    lastUserMessage?.content?.trim() || scope?.label || "论文上下文";

  try {
    const evidence = await searchEvidence(question, scope);
    let content = "";
    if (evidence.items.length > 0) {
      content =
        "\n\n=== 外部证据 ===\n以下外部证据只能作为补充参考，请明确区分哪些内容来自当前论文，哪些来自联网查证。\n";
      evidence.items.forEach((item, index) => {
        content += `\n[E${index + 1}] ${item.title}`;
        if (item.authors.length > 0) {
          content += ` — ${item.authors.join(", ")}`;
        }
        if (item.year) {
          content += ` (${item.year})`;
        }
        if (item.source) {
          content += `\n来源：${item.source}`;
        }
        if (item.url) {
          content += `\n链接：${item.url}`;
        }
        if (item.snippet) {
          content += `\n摘录：${item.snippet}`;
        }
        content += "\n";
      });
    }
    return {
      content,
      auditMessage: `联网查证：${getEvidenceAuditLabel(
        evidence.providerMode,
      )} · ${evidence.items.length} 条结果`,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Evidence search failed";
    return {
      content: "",
      auditMessage: `联网查证失败：${message}，本轮仅基于当前论文回答`,
    };
  }
}

async function collectTextStream(
  stream: StreamingResponse["stream"],
): Promise<string> {
  let content = "";
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      content += chunk;
    }
  }
  return content;
}

function toPersistedMessage(message: CompressionSessionMessage): Message {
  return {
    ...message,
    id: `context-compression-${message.compressedThroughMessageId}`,
    timestamp: Date.now(),
  };
}

function formatScopeType(type: ScopeContext["type"]): string {
  switch (type) {
    case "paper":
      return "论文";
    case "pdf":
      return "PDF";
    case "collection":
      return "分类";
    case "manual-selection":
      return "选中内容";
    default:
      return String(type);
  }
}

function formatAvailability(availability: string): string {
  switch (availability) {
    case "pdf-text-ready":
      return "PDF 正文可用";
    case "fulltext-required-error":
      return "全文不可用";
    case "fulltext-unsupported-scope":
      return "范围不支持";
    case "abstract-only":
      return "仅摘要";
    case "metadata-only":
      return "仅元数据";
    case "collection-truncated":
      return "分类内容已截断";
    default:
      return availability;
  }
}

function normalizeProviderError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /context[_\s-]*length[_\s-]*exceeded/i.test(message) ||
    /maximum context length/i.test(message)
  ) {
    return new Error("当前请求超出所选模型的上下文窗口，无法发送。");
  }
  return error instanceof Error ? error : new Error(message);
}
