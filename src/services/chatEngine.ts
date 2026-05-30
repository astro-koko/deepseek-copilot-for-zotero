import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type {
  ChatCompletionMessage,
  StreamingResponse,
} from "./provider/types";
import { createOpenAICompatibleProvider } from "./provider/openAICompatibleProvider";
import { assembleContext } from "./contextAssembler";
import { getPref } from "../utils/prefs";

export function buildSystemPrompt(scope: ScopeContext | undefined): string {
  const basePrompt = `You are an AI reading assistant operating inside Zotero. You help researchers understand papers, compare findings, and explore their literature collections.

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

export function buildMessages(
  thread: Thread,
  scope: ScopeContext | undefined,
): ChatCompletionMessage[] {
  let contextContent = "";
  if (scope) {
    try {
      const assembled = assembleContext(scope);
      contextContent = `\n\n=== CONTEXT ===\n${assembled.metadata}`;
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

  return messages;
}

export async function sendChatMessage(
  thread: Thread,
  userMessage: string,
  scope: ScopeContext | undefined,
  signal?: AbortSignal,
): Promise<StreamingResponse> {
  const baseURL = (getPref("baseURL") || "https://api.openai.com/v1") as string;
  const apiKey = (getPref("apiKey") || "") as string;
  const model = (getPref("model") || "gpt-4o-mini") as string;

  if (!apiKey) {
    throw new Error("API key not configured. Please set it in Settings.");
  }

  const provider = createOpenAICompatibleProvider({ baseURL, apiKey, model });

  const messages = buildMessages(thread, scope);
  messages.push({ role: "user", content: userMessage });

  return provider.sendChat(messages, signal);
}
