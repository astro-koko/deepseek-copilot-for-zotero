import React, { useState, useCallback, useEffect, useRef } from "react";
import { ScopeBar } from "./ScopeBar";
import { ThreadView } from "./ThreadView";
import { Composer } from "./Composer";
import type { ScopeContext } from "../../types/scope";
import type { Thread } from "../../types/thread";
import {
  createThread,
  appendMessage,
  recordScopeTransition,
} from "../../services/threadController";
import { sendChatMessage } from "../../services/chatEngine";
import { getCurrentScope } from "../../services/scopeResolver";

interface SidebarProps {
  location: "library" | "reader";
  eventBus: EventTarget;
}

export const Sidebar: React.FC<SidebarProps> = ({ location, eventBus }) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [scope, setScope] = useState<ScopeContext | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Listen for scope changes from event bus
  useEffect(() => {
    const handleScopeChange = (e: Event) => {
      const newScope = (e as CustomEvent).detail as ScopeContext | null;
      setScope((prev) => {
        if (
          !newScope ||
          !prev ||
          newScope.type !== prev.type ||
          newScope.id !== prev.id
        ) {
          if (newScope && thread) {
            recordScopeTransition(thread.id, newScope).then((updated) => {
              if (updated) setThread(updated);
            });
          }
          return newScope;
        }
        return prev;
      });
    };

    eventBus.addEventListener("scopeChange", handleScopeChange);
    return () => eventBus.removeEventListener("scopeChange", handleScopeChange);
  }, [eventBus, thread]);

  // Initial scope resolution
  useEffect(() => {
    setScope(getCurrentScope());
  }, []);

  const handleNewThread = useCallback(async () => {
    const currentScope = getCurrentScope();
    const newThread = await createThread(currentScope || undefined);
    setThread(newThread);
    setScope(currentScope);
    setError(null);
  }, []);

  const handleSend = useCallback(
    async (userInput: string) => {
      setError(null);

      if (!thread) {
        await handleNewThread();
        return;
      }

      // Add user message
      const updated = await appendMessage(thread.id, {
        role: "user",
        content: userInput,
      });
      if (updated) setThread(updated);

      setIsStreaming(true);
      setStreamingContent("");

      try {
        abortRef.current = new AbortController();
        const response = await sendChatMessage(
          thread,
          userInput,
          scope || undefined,
          abortRef.current.signal,
        );

        let fullResponse = "";
        for await (const chunk of response.stream) {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        }

        const finalThread = await appendMessage(thread.id, {
          role: "assistant",
          content: fullResponse,
        });
        if (finalThread) setThread(finalThread);
      } catch (err: any) {
        const msg = err.message || "Failed to get response";
        setError(msg);
        const errorThread = await appendMessage(thread.id, {
          role: "assistant",
          content: `Error: ${msg}`,
        });
        if (errorThread) setThread(errorThread);
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [thread, scope, handleNewThread],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <div style={styles.container}>
      <ScopeBar scope={scope} />
      <div style={styles.toolbar}>
        <button style={styles.newThreadBtn} onClick={handleNewThread}>
          New Thread
        </button>
      </div>
      <ThreadView thread={thread} />
      {isStreaming && streamingContent && (
        <div style={styles.streaming}>
          <div style={styles.streamingLabel}>AI is thinking...</div>
          <div style={styles.streamingContent}>{streamingContent}</div>
        </div>
      )}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}
      <Composer
        onSend={handleSend}
        onCancel={handleCancel}
        isStreaming={isStreaming}
        currentScopeType={scope?.type || null}
      />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#fff",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  toolbar: {
    padding: "4px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  newThreadBtn: {
    padding: "4px 12px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  streaming: {
    padding: "8px 12px",
    borderTop: "1px solid #e0e0e0",
    background: "#fafafa",
  },
  streamingLabel: {
    fontSize: "11px",
    color: "#888",
    marginBottom: "4px",
  },
  streamingContent: {
    fontSize: "14px",
    lineHeight: 1.5,
    color: "#333",
    whiteSpace: "pre-wrap",
  },
  error: {
    padding: "8px 12px",
    background: "#ffebee",
    color: "#c62828",
    fontSize: "13px",
    borderTop: "1px solid #ef9a9a",
  },
};
