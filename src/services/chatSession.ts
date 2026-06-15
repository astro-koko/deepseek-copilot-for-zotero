import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type { ChatStreamChunk } from "./provider/types";
import {
  appendMessage,
  createThread,
  recordScopeTransition,
} from "./threadController";
import { type ChatRequestOptions, sendChatMessage } from "./chatEngine";

export type ChatSessionStreamingStatus =
  | "idle"
  | "preparing"
  | "waiting"
  | "reasoning"
  | "streaming";

export interface ChatSessionState {
  activeThread: Thread | null;
  error: string | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingReasoningContent: string;
  streamingStatus: ChatSessionStreamingStatus;
}

interface ChatSessionDeps {
  appendMessage: typeof appendMessage;
  createThread: typeof createThread;
  recordScopeTransition: typeof recordScopeTransition;
  sendChatMessage: typeof sendChatMessage;
}

interface ChatSessionStore {
  cancel(): void;
  getSnapshot(): ChatSessionState;
  newThread(scope?: ScopeContext | null): Promise<Thread>;
  openThread(thread: Thread): void;
  reset(): void;
  send(
    message: string,
    scope?: ScopeContext | null,
    requestOptions?: ChatRequestOptions,
  ): Promise<void>;
  subscribe(listener: () => void): () => void;
  syncScope(scope?: ScopeContext | null): Promise<void>;
}

const DEFAULT_STATE: ChatSessionState = {
  activeThread: null,
  error: null,
  isStreaming: false,
  streamingContent: "",
  streamingReasoningContent: "",
  streamingStatus: "idle",
};

interface AbortControllerLike {
  abort(): void;
  signal?: AbortSignal;
}

function hasScopeChanged(
  thread: Thread,
  scope: ScopeContext | null | undefined,
): boolean {
  if (!scope) {
    return false;
  }

  return (
    thread.scopeSnapshot?.type !== scope.type ||
    thread.scopeSnapshot?.id !== scope.id
  );
}

function buildErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to get response";
}

function normalizeStreamChunk(chunk: ChatStreamChunk): {
  contentDelta?: string;
  reasoningDelta?: string;
  status?: ChatSessionStreamingStatus;
} {
  if (typeof chunk === "string") {
    return {
      contentDelta: chunk,
      status: "streaming",
    };
  }

  if (chunk.type === "reasoning_delta") {
    return {
      reasoningDelta: chunk.content,
      status: "reasoning",
    };
  }

  if (chunk.type === "status") {
    return {
      status:
        chunk.content === "preparing" ||
        chunk.content === "waiting" ||
        chunk.content === "reasoning" ||
        chunk.content === "streaming"
          ? chunk.content
          : "waiting",
    };
  }

  return {};
}

export function createChatSessionStore(
  deps: ChatSessionDeps,
): ChatSessionStore {
  const listeners = new Set<() => void>();
  let state: ChatSessionState = { ...DEFAULT_STATE };
  let abortController: AbortControllerLike | null = null;
  let requestVersion = 0;

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const setState = (partial: Partial<ChatSessionState>) => {
    state = { ...state, ...partial };
    emit();
  };

  const invalidatePendingRequest = () => {
    requestVersion += 1;
  };

  const isCurrentRequest = (version: number) => version === requestVersion;
  const createAbortController = (): AbortControllerLike | null => {
    const AbortControllerCtor = (globalThis as any).AbortController;
    if (typeof AbortControllerCtor !== "function") {
      return null;
    }

    return new AbortControllerCtor();
  };

  const ensureScopedThread = async (
    thread: Thread,
    scope?: ScopeContext | null,
  ): Promise<Thread> => {
    if (!hasScopeChanged(thread, scope)) {
      return thread;
    }

    const updated = await deps.recordScopeTransition(thread.id, scope!);
    if (!updated) {
      return thread;
    }

    setState({ activeThread: updated });
    return updated;
  };

  const persistAssistantMessage = async (
    thread: Thread,
    message: Message["content"],
    version: number,
  ): Promise<void> => {
    if (!isCurrentRequest(version)) {
      return;
    }

    const updated = await deps.appendMessage(thread.id, {
      role: "assistant",
      content: message,
    });
    if (updated) {
      setState({ activeThread: updated });
    }
  };

  return {
    cancel() {
      abortController?.abort();
      abortController = null;
      invalidatePendingRequest();
      setState({
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      });
    },

    getSnapshot() {
      return state;
    },

    async newThread(scope?: ScopeContext | null) {
      abortController?.abort();
      abortController = null;
      invalidatePendingRequest();
      const thread = await deps.createThread(scope || undefined);
      setState({
        activeThread: thread,
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      });
      return thread;
    },

    openThread(thread: Thread) {
      abortController?.abort();
      abortController = null;
      invalidatePendingRequest();
      setState({
        activeThread: thread,
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      });
    },

    reset() {
      abortController?.abort();
      abortController = null;
      invalidatePendingRequest();
      state = { ...DEFAULT_STATE };
      emit();
    },

    async send(
      message: string,
      scope?: ScopeContext | null,
      requestOptions?: ChatRequestOptions,
    ) {
      const trimmed = message.trim();
      if (!trimmed || state.isStreaming) {
        return;
      }

      setState({ error: null });
      let thread: Thread | null = null;
      let version: number | null = null;
      let shouldPersistFailureMessage = false;
      let assistantMessagePersistenceAttempted = false;

      try {
        thread = state.activeThread;
        if (!thread) {
          thread = await deps.createThread(scope || undefined);
          setState({ activeThread: thread });
        }

        thread = await ensureScopedThread(thread, scope);

        const threadWithUserMessage = await deps.appendMessage(thread.id, {
          role: "user",
          content: trimmed,
        });

        if (!threadWithUserMessage) {
          throw new Error("Failed to save user message");
        }

        thread = threadWithUserMessage;
        abortController = createAbortController();
        version = ++requestVersion;
        shouldPersistFailureMessage = true;
        setState({
          activeThread: thread,
          error: null,
          isStreaming: true,
          streamingContent: "",
          streamingReasoningContent: "",
          streamingStatus: "preparing",
        });

        const response = await deps.sendChatMessage(
          thread,
          scope || undefined,
          requestOptions,
          abortController?.signal,
        );
        if (!isCurrentRequest(version)) {
          return;
        }

        setState({ streamingStatus: "waiting" });

        if (response.evidenceAuditMessage) {
          const auditedThread = await deps.appendMessage(thread.id, {
            role: "system",
            content: response.evidenceAuditMessage,
          });
          if (auditedThread) {
            thread = auditedThread;
            setState({ activeThread: auditedThread });
          }
        }

        let fullResponse = "";
        let fullReasoning = "";
        for await (const chunk of response.stream) {
          if (!isCurrentRequest(version)) {
            return;
          }

          const normalizedChunk = normalizeStreamChunk(chunk);
          if (normalizedChunk.contentDelta) {
            fullResponse += normalizedChunk.contentDelta;
          }
          if (normalizedChunk.reasoningDelta) {
            fullReasoning += normalizedChunk.reasoningDelta;
          }

          setState({
            streamingContent: fullResponse,
            streamingReasoningContent: fullReasoning,
            streamingStatus: normalizedChunk.status || "streaming",
          });
        }

        assistantMessagePersistenceAttempted = true;
        await persistAssistantMessage(thread, fullResponse, version);

        if (isCurrentRequest(version)) {
          abortController = null;
          setState({
            isStreaming: false,
            streamingContent: "",
            streamingReasoningContent: "",
            streamingStatus: "idle",
          });
        }
      } catch (error) {
        const messageText = buildErrorMessage(error);

        if (version == null) {
          setState({
            error: messageText,
            isStreaming: false,
            streamingContent: "",
            streamingReasoningContent: "",
            streamingStatus: "idle",
          });
          abortController = null;
          return;
        }

        if (!isCurrentRequest(version)) {
          return;
        }

        setState({ error: messageText });

        if (
          thread &&
          shouldPersistFailureMessage &&
          !assistantMessagePersistenceAttempted
        ) {
          try {
            await persistAssistantMessage(
              thread,
              `Error: ${messageText}`,
              version,
            );
          } catch (persistError) {
            ztoolkit.log(
              "Failed to persist assistant error message:",
              persistError,
            );
          }
        }

        abortController = null;
        setState({
          isStreaming: false,
          streamingContent: "",
          streamingReasoningContent: "",
          streamingStatus: "idle",
        });
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async syncScope(scope?: ScopeContext | null) {
      if (!state.activeThread) {
        return;
      }

      const updated = await ensureScopedThread(state.activeThread, scope);
      if (updated !== state.activeThread) {
        setState({ activeThread: updated });
      }
    },
  };
}

export const chatSessionStore = createChatSessionStore({
  appendMessage,
  createThread,
  recordScopeTransition,
  sendChatMessage,
});
