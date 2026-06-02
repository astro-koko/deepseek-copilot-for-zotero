import React, { useRef, useEffect } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
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

function canUseZoteroLaunchURL(): boolean {
  return (
    typeof (globalThis as { Zotero?: { launchURL?: unknown } }).Zotero?.launchURL ===
    "function"
  );
}

export function openMarkdownLink(
  href: string,
  event: { preventDefault: () => void },
): void {
  event.preventDefault();
  const launchURL = (globalThis as { Zotero?: { launchURL?: (url: string) => void } }).Zotero
    ?.launchURL;
  launchURL?.(href);
}

function buildMarkdownComponents(
  theme: ReturnType<typeof getSidebarTheme>,
): Components {
  return {
    a: ({ node: _node, href, children, ...props }) => (
      <a
        {...props}
        href={href}
        rel="noopener noreferrer"
        style={{ color: theme.badgeText }}
        target="_blank"
        onClick={
          href && canUseZoteroLaunchURL()
            ? (event) => openMarkdownLink(href, event)
            : undefined
        }
      >
        {children}
      </a>
    ),
    blockquote: ({ node: _node, children, ...props }) => (
      <blockquote
        {...props}
        style={{
          margin: "6px 0",
          padding: "0 0 0 10px",
          borderLeft: `3px solid ${theme.softBorder}`,
          color: theme.mutedText,
        }}
      >
        {children}
      </blockquote>
    ),
    code: ({ node: _node, children, className, ...props }) => (
      <code {...props} className={className}>
        {children}
      </code>
    ),
    h1: ({ node: _node, children, ...props }) => (
      <h1 {...props} style={{ margin: "0 0 8px", fontSize: "16px", lineHeight: 1.3 }}>
        {children}
      </h1>
    ),
    h2: ({ node: _node, children, ...props }) => (
      <h2 {...props} style={{ margin: "0 0 7px", fontSize: "15px", lineHeight: 1.35 }}>
        {children}
      </h2>
    ),
    h3: ({ node: _node, children, ...props }) => (
      <h3 {...props} style={{ margin: "0 0 6px", fontSize: "14px", lineHeight: 1.35 }}>
        {children}
      </h3>
    ),
    h4: ({ node: _node, children, ...props }) => (
      <h4 {...props} style={{ margin: "0 0 6px", fontSize: "13px", lineHeight: 1.35 }}>
        {children}
      </h4>
    ),
    h5: ({ node: _node, children, ...props }) => (
      <h5 {...props} style={{ margin: "0 0 5px", fontSize: "12px", lineHeight: 1.35 }}>
        {children}
      </h5>
    ),
    h6: ({ node: _node, children, ...props }) => (
      <h6 {...props} style={{ margin: "0 0 5px", fontSize: "12px", lineHeight: 1.35 }}>
        {children}
      </h6>
    ),
    ol: ({ node: _node, children, ...props }) => (
      <ol {...props} style={{ margin: "6px 0", paddingLeft: "18px" }}>
        {children}
      </ol>
    ),
    p: ({ node: _node, children, ...props }) => (
      <p {...props} style={{ margin: "0 0 6px" }}>
        {children}
      </p>
    ),
    pre: ({ node: _node, children, ...props }) => (
      <pre
        {...props}
        style={{
          margin: "6px 0",
          padding: "8px",
          overflowX: "auto",
          background: theme.panelBackground,
          border: `1px solid ${theme.softBorder}`,
          borderRadius: "4px",
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </pre>
    ),
    table: ({ node: _node, children, ...props }) => (
      <table
        {...props}
        style={{
          width: "100%",
          margin: "6px 0",
          borderCollapse: "collapse",
          fontSize: "11px",
        }}
      >
        {children}
      </table>
    ),
    td: ({ node: _node, children, ...props }) => (
      <td
        {...props}
        style={{
          border: `1px solid ${theme.softBorder}`,
          padding: "4px 6px",
          verticalAlign: "top",
        }}
      >
        {children}
      </td>
    ),
    th: ({ node: _node, children, ...props }) => (
      <th
        {...props}
        style={{
          border: `1px solid ${theme.softBorder}`,
          padding: "4px 6px",
          textAlign: "left",
          background: theme.panelBackground,
        }}
      >
        {children}
      </th>
    ),
    ul: ({ node: _node, children, ...props }) => (
      <ul {...props} style={{ margin: "6px 0", paddingLeft: "18px" }}>
        {children}
      </ul>
    ),
  };
}

const MarkdownMessage: React.FC<{
  content: string;
  theme: ReturnType<typeof getSidebarTheme>;
}> = ({ content, theme }) => (
  <div style={styles.content}>
    <ReactMarkdown
      components={buildMarkdownComponents(theme)}
      remarkPlugins={[remarkGfm, remarkBreaks]}
    >
      {content}
    </ReactMarkdown>
  </div>
);

const MessageBubble: React.FC<{
  message: Message;
  theme: ReturnType<typeof getSidebarTheme>;
}> = ({ message, theme }) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div
      style={{
        ...(isSystem ? styles.systemMessage : styles.message),
        alignSelf: isSystem ? "center" : isUser ? "flex-end" : "flex-start",
        background: isSystem
          ? theme.systemMessageBackground
          : isUser
            ? theme.userMessageBackground
            : theme.assistantMessageBackground,
        color: isSystem ? theme.mutedText : theme.text,
        borderColor: isSystem
          ? theme.systemMessageBorder
          : isUser
            ? theme.userMessageBorder
            : theme.assistantMessageBorder,
      }}
    >
      <MarkdownMessage content={message.content} theme={theme} />
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
