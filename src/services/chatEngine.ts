import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type {
  ChatCompletionMessage,
  StreamingResponse,
} from "./provider/types";
import { createOpenAICompatibleProvider } from "./provider/openAICompatibleProvider";
import { assembleContext } from "./contextAssembler";
import { getEvidenceAuditLabel, getSettings } from "./settingsManager";
import { searchEvidence } from "./evidenceSearch";

export interface ChatRequestOptions {
  evidenceEnabled?: boolean;
}

export function buildSystemPrompt(scope: ScopeContext | undefined): string {
  const basePrompt = `你是 DS Copilot，是运行在 Zotero 内的 AI 阅读助手。你的任务是帮助研究者理解论文、比较研究发现，并梳理他们的文献库。

关键规则：
- 你只能使用当前明确提供的上下文范围。
- 不要假装自己看到了当前范围之外的内容。
- 如果问题针对分类范围，请只基于当前纳入范围的条目进行综合。
- 回答要简洁但充分，必要时可以使用 Markdown。
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
  if (scope) {
    try {
      const assembled = await assembleContext(scope);
      contextContent =
        `\n\n=== 上下文状态 ===\n可用性：${formatAvailability(assembled.availability)}\n` +
        `警告：${assembled.warnings.length > 0 ? assembled.warnings.join(" | ") : "无"}`;
      contextContent += `\n\n=== 上下文 ===\n${assembled.metadata}`;
      if (assembled.selectedText) {
        contextContent += `\n\n=== 选中文本 ===\n${assembled.selectedText}`;
      }
      if (assembled.fullText) {
        contextContent += `\n\n=== 正文内容 ===\n${assembled.fullText}`;
      }
    } catch (e) {
      ztoolkit.log("Context assembly failed:", e);
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

  return Object.assign(messages, { evidenceAuditMessage });
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
  const response = await provider.sendChat(messages, signal);
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
