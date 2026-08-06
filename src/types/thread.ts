import type { ScopeContext } from "./scope";

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  kind?: "context-compression";
  compressedThroughMessageId?: string;
  contextSummary?: string;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  scopeKey?: string;
  scopeSnapshot?: ScopeContext;
  messages: Message[];
}
