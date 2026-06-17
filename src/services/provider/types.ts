export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatStreamChunk =
  | string
  | {
      type: "reasoning_delta" | "status";
      content: string;
    };

export interface StreamingResponse {
  abort: () => void;
  evidenceAuditMessage?: string;
  stream: AsyncIterable<ChatStreamChunk>;
}

export interface ProviderRequestDiagnostics {
  fullTextChars?: number;
  fullTextSource?: string;
  systemPromptChars?: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream: true;
  temperature?: number;
  max_tokens?: number;
}
