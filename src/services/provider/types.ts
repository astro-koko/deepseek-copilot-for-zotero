export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamingResponse {
  abort: () => void;
  evidenceAuditMessage?: string;
  stream: AsyncIterable<string>;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  stream: true;
  temperature?: number;
  max_tokens?: number;
}
