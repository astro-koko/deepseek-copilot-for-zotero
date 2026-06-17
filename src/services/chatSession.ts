import type { ScopeContext } from "../types/scope";
import type { Thread, Message } from "../types/thread";
import type { ChatStreamChunk } from "./provider/types";
import {
  appendMessage,
  createThread,
  getScopeKey,
  getThreadScopeKey,
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

const GLOBAL_SCOPE_KEY = "__global__";

interface AbortControllerLike {
  abort(): void;
  signal?: AbortSignal;
}

function isThreadInScope(
  thread: Thread | null,
  scope: ScopeContext | null | undefined,
): boolean {
  if (!thread) {
    return false;
  }

  if (!scope) {
    return true;
  }

  const scopeKey = getScopeKey(scope);
  if (!scopeKey) {
    return true;
  }

  return getThreadScopeKey(thread) === scopeKey;
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
  const statesByScope = new Map<string, ChatSessionState>();
  const abortControllersByScope = new Map<string, AbortControllerLike | null>();
  const requestVersionsByScope = new Map<string, number>();
  let activeScopeKey = GLOBAL_SCOPE_KEY;

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const getStateForKey = (scopeKey: string): ChatSessionState => {
    const existing = statesByScope.get(scopeKey);
    if (existing) {
      return existing;
    }

    const initialState = { ...DEFAULT_STATE };
    statesByScope.set(scopeKey, initialState);
    return initialState;
  };

  const setState = (
    partial: Partial<ChatSessionState>,
    scopeKey = activeScopeKey,
  ) => {
    statesByScope.set(scopeKey, {
      ...getStateForKey(scopeKey),
      ...partial,
    });
    emit();
  };

  const getSessionScopeKey = (scope?: ScopeContext | null): string =>
    getScopeKey(scope) || GLOBAL_SCOPE_KEY;

  const getRequestVersion = (scopeKey: string): number =>
    requestVersionsByScope.get(scopeKey) ?? 0;

  const invalidatePendingRequest = (scopeKey: string) => {
    requestVersionsByScope.set(scopeKey, getRequestVersion(scopeKey) + 1);
  };

  const isCurrentRequest = (scopeKey: string, version: number) =>
    version === getRequestVersion(scopeKey);

  const createAbortController = (): AbortControllerLike | null => {
    const AbortControllerCtor = (globalThis as any).AbortController;
    if (typeof AbortControllerCtor !== "function") {
      return null;
    }

    return new AbortControllerCtor();
  };

  const persistAssistantMessage = async (
    thread: Thread,
    message: Message["content"],
    scopeKey: string,
    version: number,
  ): Promise<void> => {
    if (!isCurrentRequest(scopeKey, version)) {
      return;
    }

    const updated = await deps.appendMessage(thread.id, {
      role: "assistant",
      content: message,
    });
    if (updated) {
      setState({ activeThread: updated }, scopeKey);
    }
  };

  const abortScopeRequest = (scopeKey: string): void => {
    abortControllersByScope.get(scopeKey)?.abort();
    abortControllersByScope.set(scopeKey, null);
  };

  return {
    cancel() {
      abortScopeRequest(activeScopeKey);
      invalidatePendingRequest(activeScopeKey);
      setState({
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      });
    },

    getSnapshot() {
      return getStateForKey(activeScopeKey);
    },

    async newThread(scope?: ScopeContext | null) {
      const scopeKey = getSessionScopeKey(scope);
      activeScopeKey = scopeKey;
      abortScopeRequest(scopeKey);
      invalidatePendingRequest(scopeKey);
      const thread = await deps.createThread(scope || undefined);
      setState({
        activeThread: thread,
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      }, scopeKey);
      return thread;
    },

    openThread(thread: Thread) {
      const scopeKey = getThreadScopeKey(thread) || activeScopeKey;
      activeScopeKey = scopeKey;
      abortScopeRequest(scopeKey);
      invalidatePendingRequest(scopeKey);
      setState({
        activeThread: thread,
        error: null,
        isStreaming: false,
        streamingContent: "",
        streamingReasoningContent: "",
        streamingStatus: "idle",
      }, scopeKey);
    },

    reset() {
      for (const scopeKey of abortControllersByScope.keys()) {
        abortScopeRequest(scopeKey);
        invalidatePendingRequest(scopeKey);
      }
      statesByScope.clear();
      activeScopeKey = GLOBAL_SCOPE_KEY;
      statesByScope.set(GLOBAL_SCOPE_KEY, { ...DEFAULT_STATE });
      emit();
    },

    async send(
      message: string,
      scope?: ScopeContext | null,
      requestOptions?: ChatRequestOptions,
    ) {
      const trimmed = message.trim();
      const scopeKey = getSessionScopeKey(scope);
      activeScopeKey = scopeKey;
      const sessionState = getStateForKey(scopeKey);
      if (!trimmed || sessionState.isStreaming) {
        return;
      }

      setState({ error: null }, scopeKey);
      let thread: Thread | null = null;
      let version: number | null = null;
      let shouldPersistFailureMessage = false;
      let assistantMessagePersistenceAttempted = false;

      try {
        thread = sessionState.activeThread;
        if (!thread || !isThreadInScope(thread, scope)) {
          thread = await deps.createThread(scope || undefined);
          setState({ activeThread: thread }, scopeKey);
        }

        const threadWithUserMessage = await deps.appendMessage(thread.id, {
          role: "user",
          content: trimmed,
        });

        if (!threadWithUserMessage) {
          throw new Error("Failed to save user message");
        }

        thread = threadWithUserMessage;
        const abortController = createAbortController();
        abortControllersByScope.set(scopeKey, abortController);
        version = getRequestVersion(scopeKey) + 1;
        requestVersionsByScope.set(scopeKey, version);
        shouldPersistFailureMessage = true;
        setState({
          activeThread: thread,
          error: null,
          isStreaming: true,
          streamingContent: "",
          streamingReasoningContent: "",
          streamingStatus: "preparing",
        }, scopeKey);

        const response = await deps.sendChatMessage(
          thread,
          scope || undefined,
          requestOptions,
          abortController?.signal,
        );
        if (!isCurrentRequest(scopeKey, version)) {
          return;
        }

        setState({ streamingStatus: "waiting" }, scopeKey);

        if (response.evidenceAuditMessage) {
          const auditedThread = await deps.appendMessage(thread.id, {
            role: "system",
            content: response.evidenceAuditMessage,
          });
          if (auditedThread) {
            thread = auditedThread;
            setState({ activeThread: auditedThread }, scopeKey);
          }
        }

        let fullResponse = "";
        let fullReasoning = "";
        for await (const chunk of response.stream) {
          if (!isCurrentRequest(scopeKey, version)) {
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
          }, scopeKey);
        }

        assistantMessagePersistenceAttempted = true;
        await persistAssistantMessage(thread, fullResponse, scopeKey, version);

        if (isCurrentRequest(scopeKey, version)) {
          abortControllersByScope.set(scopeKey, null);
          setState({
            isStreaming: false,
            streamingContent: "",
            streamingReasoningContent: "",
            streamingStatus: "idle",
          }, scopeKey);
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
          }, scopeKey);
          abortControllersByScope.set(scopeKey, null);
          return;
        }

        if (!isCurrentRequest(scopeKey, version)) {
          return;
        }

        setState({ error: messageText }, scopeKey);

        if (
          thread &&
          shouldPersistFailureMessage &&
          !assistantMessagePersistenceAttempted
        ) {
          try {
            await persistAssistantMessage(
              thread,
              `Error: ${messageText}`,
              scopeKey,
              version,
            );
          } catch (persistError) {
            ztoolkit.log(
              "Failed to persist assistant error message:",
              persistError,
            );
          }
        }

        abortControllersByScope.set(scopeKey, null);
        setState({
          isStreaming: false,
          streamingContent: "",
          streamingReasoningContent: "",
          streamingStatus: "idle",
        }, scopeKey);
      }
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async syncScope(scope?: ScopeContext | null) {
      const scopeKey = getSessionScopeKey(scope);
      activeScopeKey = scopeKey;
      const sessionState = getStateForKey(scopeKey);
      if (!sessionState.activeThread) {
        emit();
        return;
      }

      if (!isThreadInScope(sessionState.activeThread, scope)) {
        setState({
          activeThread: null,
          error: null,
          isStreaming: false,
          streamingContent: "",
          streamingReasoningContent: "",
          streamingStatus: "idle",
        }, scopeKey);
      } else {
        emit();
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
