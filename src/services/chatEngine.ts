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

const DOCUMENT_TAIL_HIGHLIGHT_CHARS = 2500;
const DOCUMENT_TAIL_HIGHLIGHT_MIN_FULLTEXT_CHARS = 4000;

export function buildSystemPrompt(scope: ScopeContext | undefined): string {
  const basePrompt = `你是 Deepseek Copliot，是运行在 Zotero 内的 AI 阅读助手。你的任务是帮助研究者理解论文、比较研究发现，并梳理他们的文献库。

关键规则：
- 你只能使用当前明确提供的上下文范围。
- 不要假装自己看到了当前范围之外的内容。
- 如果问题针对分类范围，请只基于当前纳入范围的条目进行综合。
- 回答要简洁但充分，必要时可以使用 Markdown。
- 如果系统上下文中提供了“文档末尾重点”片段，而用户在问最后一页、文末、附录结尾或最后几页，请先核对该片段，再结合全文回答。
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
): Promise<ChatCompletionMessage[]> {
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
    if (assembledContext.selectedText) {
      contextContent += `\n\n=== 选中文本 ===\n${assembledContext.selectedText}`;
    }
    if (assembledContext.fullText) {
      contextContent += `\n\n=== 正文内容 ===\n${assembledContext.fullText}`;
      const documentTailHighlight = buildDocumentTailHighlight(
        assembledContext.fullText,
      );
      if (documentTailHighlight) {
        contextContent +=
          `\n\n=== 文档末尾重点 ===\n` +
          "以下片段直接截取自同一篇正文的末尾，用于帮助回答最后一页、附录结尾或文末相关问题。\n" +
          `${documentTailHighlight}`;
      }
    }
  }

  if (requestOptions.evidenceEnabled) {
    const lastUserMessage = [...thread.messages]
      .reverse()
      .find((message) => message.role === "user");
    const question = lastUserMessage?.content?.trim() || scope?.label || "论文上下文";
    try {
      const evidence = await searchEvidence(question, scope);
      if (evidence.items.length > 0) {
        contextContent += `\n\n=== 外部证据 ===\n以下外部证据只能作为补充参考，请明确区分哪些内容来自当前论文，哪些来自联网查证。\n`;
        evidence.items.forEach((item, index) => {
          contextContent += `\n[E${index + 1}] ${item.title}`;
          if (item.authors.length > 0) {
            contextContent += ` — ${item.authors.join(", ")}`;
          }
          if (item.year) {
            contextContent += ` (${item.year})`;
          }
          if (item.source) {
            contextContent += `\n来源：${item.source}`;
          }
          if (item.url) {
            contextContent += `\n链接：${item.url}`;
          }
          if (item.snippet) {
            contextContent += `\n摘录：${item.snippet}`;
          }
          contextContent += "\n";
        });
      }
      evidenceAuditMessage = `联网查证：${getEvidenceAuditLabel(
        evidence.providerMode,
      )} · ${evidence.items.length} 条结果`;
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Evidence search failed";
      evidenceAuditMessage = `联网查证失败：${message}，本轮仅基于当前论文回答`;
    }
  }

  const messages: ChatCompletionMessage[] = [
    { role: "system", content: buildSystemPrompt(scope) + contextContent },
  ];

  // Add recent thread history (last 20 messages)
  const recentMessages = thread.messages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "system") continue; // Skip scope transition messages
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  return Object.assign(messages, { evidenceAuditMessage, assembledContext });
}

export async function sendChatMessage(
  thread: Thread,
  scope: ScopeContext | undefined,
  requestOptions: ChatRequestOptions = {},
  signal?: AbortSignal,
): Promise<StreamingResponse> {
  const { baseURL, apiKey, model } = getSettings();

  if (!apiKey) {
    throw new Error("API Key 尚未配置，请先在设置中填写。");
  }

  const provider = createOpenAICompatibleProvider({ baseURL, apiKey, model });

  const messages = await buildMessages(thread, scope, requestOptions);
  const systemMessage = messages[0]?.content || "";
  const assembledContext = (messages as typeof messages & {
    assembledContext?: AssembledContext;
  }).assembledContext;

  let response: StreamingResponse;
  try {
    response = await provider.sendChat(messages, signal, {
      fullTextChars: assembledContext?.fullText.length || 0,
      fullTextSource: assembledContext?.fullTextSource,
      systemPromptChars: systemMessage.length,
    });
  } catch (error) {
    throw normalizeProviderError(error);
  }
  return {
    ...response,
    evidenceAuditMessage: (messages as typeof messages & {
      evidenceAuditMessage?: string;
    }).evidenceAuditMessage,
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
    return new Error("当前论文全文超出模型上下文上限，请更换模型或缩小范围。");
  }
  return error instanceof Error ? error : new Error(message);
}

function buildDocumentTailHighlight(fullText: string): string {
  const normalized = fullText.trim();
  if (normalized.length < DOCUMENT_TAIL_HIGHLIGHT_MIN_FULLTEXT_CHARS) {
    return "";
  }

  const rawExcerpt = normalized.slice(-DOCUMENT_TAIL_HIGHLIGHT_CHARS);
  const firstNewline = rawExcerpt.indexOf("\n");
  if (firstNewline >= 0 && firstNewline <= 300) {
    return rawExcerpt.slice(firstNewline + 1).trim();
  }
  return rawExcerpt.trim();
}
