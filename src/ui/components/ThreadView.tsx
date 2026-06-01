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
        background: isUser ? "#eef3f8" : "#ffffff",
        color: "#2b2b2b",
        borderColor: isUser ? "#d5e0ea" : "#dcdcdc",
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
    padding: "0",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  message: {
    maxWidth: "92%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid transparent",
    fontSize: "12px",
    lineHeight: 1.45,
  },
  content: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  timestamp: {
    fontSize: "11px",
    opacity: 0.65,
    marginTop: "3px",
    textAlign: "right",
  },
  systemMessage: {
    alignSelf: "center",
    padding: "4px 8px",
    borderRadius: "5px",
    background: "#f4f4f4",
    color: "#666",
    border: "1px solid #dddddd",
    fontSize: "11px",
  },
};
