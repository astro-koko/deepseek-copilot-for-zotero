import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type {
  ChatCompletionMessage,
  StreamingResponse,
} from "./provider/types";
import { createOpenAICompatibleProvider } from "./provider/openAICompatibleProvider";
import { assembleContext } from "./contextAssembler";
import { getSettings } from "./settingsManager";
import { searchEvidence } from "./evidenceSearch";

export interface ChatRequestOptions {
  evidenceEnabled?: boolean;
}

export function buildSystemPrompt(scope: ScopeContext | undefined): string {
  const basePrompt = `You are DS Copilot, an AI reading assistant operating inside Zotero. You help researchers understand papers, compare findings, and explore their literature collections.

Key rules:
- You only have access to the explicitly provided context scope.
- Never pretend to have access beyond the current scope.
- For collection-scoped questions, synthesize answers across the included items only.
- Be concise but thorough. Use markdown formatting when helpful.
- If asked about something outside the current scope, say so clearly.`;

  if (!scope) return basePrompt;

  let scopeInfo = `\n\nCurrent scope: ${scope.type}`;
  if (scope.label) {
    scopeInfo += ` — ${scope.label}`;
  }
  if (scope.itemIds?.length) {
    scopeInfo += ` (${scope.itemIds.length} item${scope.itemIds.length > 1 ? "s" : ""})`;
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
        `\n\n=== CONTEXT STATUS ===\nAvailability: ${assembled.availability}\n` +
        `Warnings: ${assembled.warnings.length > 0 ? assembled.warnings.join(" | ") : "none"}`;
      contextContent += `\n\n=== CONTEXT ===\n${assembled.metadata}`;
      if (assembled.selectedText) {
        contextContent += `\n\n=== SELECTED TEXT ===\n${assembled.selectedText}`;
      }
      if (assembled.fullText) {
        contextContent += `\n\n=== FULL TEXT ===\n${assembled.fullText}`;
      }
    } catch (e) {
      ztoolkit.log("Context assembly failed:", e);
    }
  }

  if (requestOptions.evidenceEnabled) {
    const lastUserMessage = [...thread.messages]
      .reverse()
      .find((message) => message.role === "user");
    const question = lastUserMessage?.content?.trim() || scope?.label || "paper context";
    try {
      const evidence = await searchEvidence(question, scope);
      if (evidence.items.length > 0) {
        contextContent += `\n\n=== EXTERNAL EVIDENCE ===\nUse the following outside evidence only as supplemental context. Distinguish it clearly from the current paper.\n`;
        evidence.items.forEach((item, index) => {
          contextContent += `\n[E${index + 1}] ${item.title}`;
          if (item.authors.length > 0) {
            contextContent += ` — ${item.authors.join(", ")}`;
          }
          if (item.year) {
            contextContent += ` (${item.year})`;
          }
          if (item.source) {
            contextContent += `\nSource: ${item.source}`;
          }
          if (item.url) {
            contextContent += `\nURL: ${item.url}`;
          }
          if (item.snippet) {
            contextContent += `\nSnippet: ${item.snippet}`;
          }
          contextContent += "\n";
        });
      }
      evidenceAuditMessage = `联网查证：${evidence.providerLabel} · ${evidence.items.length} 条结果`;
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
    throw new Error("API key not configured. Please set it in Settings.");
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
