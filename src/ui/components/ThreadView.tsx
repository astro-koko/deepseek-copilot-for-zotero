import React, { useRef, useEffect } from "react";
import type { Thread, Message } from "../../types/thread";
import { EmptyState } from "./EmptyState";
import { getSidebarTheme } from "../theme";

interface ThreadViewProps {
  hasScope?: boolean;
  thread: Thread | null;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  hasScope = false,
  thread,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const theme = getSidebarTheme((globalThis as unknown as { window?: Window }).window);

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
        <MessageBubble key={msg.id} message={msg} theme={theme} />
      ))}
    </div>
  );
};

const MessageBubble: React.FC<{
  message: Message;
  theme: ReturnType<typeof getSidebarTheme>;
}> = ({ message, theme }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div
        style={{
          ...styles.systemMessage,
          background: theme.systemMessageBackground,
          color: theme.mutedText,
          borderColor: theme.systemMessageBorder,
        }}
      >
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.message,
        alignSelf: isUser ? "flex-end" : "flex-start",
        background: isUser ? theme.userMessageBackground : theme.assistantMessageBackground,
        color: theme.text,
        borderColor: isUser ? theme.userMessageBorder : theme.assistantMessageBorder,
      }}
    >
      <div style={styles.content}>{message.content}</div>
      <div style={{ ...styles.timestamp, color: theme.mutedText }}>
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: "none",
    overflow: "visible",
    padding: "0",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  message: {
    maxWidth: "94%",
    padding: "7px 9px",
    borderRadius: "4px",
    border: "1px solid transparent",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  content: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  timestamp: {
    fontSize: "10px",
    opacity: 0.65,
    marginTop: "2px",
    textAlign: "right",
  },
  systemMessage: {
    alignSelf: "center",
    padding: "3px 7px",
    borderRadius: "4px",
    background: "#f6f6f6",
    color: "#666",
    border: "1px solid #e1e1e1",
    fontSize: "11px",
  },
};
