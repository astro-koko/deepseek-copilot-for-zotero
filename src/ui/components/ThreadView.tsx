import React, { useRef, useEffect } from "react";
import type { Thread, Message } from "../../types/thread";
import { EmptyState } from "./EmptyState";

interface ThreadViewProps {
  hasScope?: boolean;
  thread: Thread | null;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  hasScope = false,
  thread,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.messages.length]);

  if (!thread || thread.messages.length === 0) {
    return (
      <div ref={scrollRef} style={styles.container}>
        <EmptyState hasScope={hasScope} />
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={styles.container}>
      {thread.messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div style={styles.systemMessage}>
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.message,
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? "#1976d2" : "#f5f5f5",
        color: isUser ? "#fff" : "#333",
      }}
    >
      <div style={styles.content}>{message.content}</div>
      <div style={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    overflow: "auto",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  message: {
    maxWidth: "85%",
    padding: "10px 14px",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  content: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  timestamp: {
    fontSize: "11px",
    opacity: 0.7,
    marginTop: "4px",
    textAlign: "right",
  },
  systemMessage: {
    alignSelf: "center",
    padding: "6px 12px",
    borderRadius: "16px",
    background: "#fff3e0",
    color: "#e65100",
    fontSize: "12px",
    fontStyle: "italic",
  },
};
