import React, { useRef, useEffect } from "react";
import katex from "katex";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { Thread, Message } from "../../types/thread";
import { EmptyState } from "./EmptyState";
import { getSidebarTheme } from "../theme";
import { typography } from "../typography";
import { isChineseLocale } from "../../utils/locale";

type MessageSegment =
  | { type: "markdown"; value: string }
  | { type: "math"; value: string; display: boolean };

interface ThreadViewProps {
  hasScope?: boolean;
  streamingMessage?: {
    content: string;
    reasoningContent?: string;
    statusLabel: string;
  } | null;
  thread: Thread | null;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  hasScope = false,
  streamingMessage = null,
  thread,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const theme = getSidebarTheme(
    (globalThis as unknown as { window?: Window }).window,
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [
    streamingMessage?.content,
    streamingMessage?.reasoningContent,
    streamingMessage?.statusLabel,
    thread?.messages.length,
  ]);

  const messages = thread?.messages || [];

  if (messages.length === 0 && !streamingMessage) {
    return (
      <div ref={scrollRef} style={styles.container}>
        <EmptyState hasScope={hasScope} />
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={styles.container}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} theme={theme} />
      ))}
      {streamingMessage && (
        <StreamingMessageBubble message={streamingMessage} theme={theme} />
      )}
    </div>
  );
};

function canUseZoteroLaunchURL(): boolean {
  return (
    typeof (globalThis as { Zotero?: { launchURL?: unknown } }).Zotero
      ?.launchURL === "function"
  );
}

export function openMarkdownLink(
  href: string,
  event: { preventDefault: () => void },
): void {
  event.preventDefault();
  const launchURL = (
    globalThis as { Zotero?: { launchURL?: (url: string) => void } }
  ).Zotero?.launchURL;
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
      <h1
        {...props}
        style={{
          margin: "0 0 8px",
          fontSize: typography.headingLg,
          lineHeight: 1.3,
        }}
      >
        {renderInlineMath(children, theme)}
      </h1>
    ),
    h2: ({ node: _node, children, ...props }) => (
      <h2
        {...props}
        style={{
          margin: "0 0 7px",
          fontSize: typography.headingMd,
          lineHeight: 1.35,
        }}
      >
        {renderInlineMath(children, theme)}
      </h2>
    ),
    h3: ({ node: _node, children, ...props }) => (
      <h3
        {...props}
        style={{
          margin: "0 0 6px",
          fontSize: typography.headingSm,
          lineHeight: 1.35,
        }}
      >
        {renderInlineMath(children, theme)}
      </h3>
    ),
    h4: ({ node: _node, children, ...props }) => (
      <h4
        {...props}
        style={{
          margin: "0 0 6px",
          fontSize: typography.headingSm,
          lineHeight: 1.35,
        }}
      >
        {renderInlineMath(children, theme)}
      </h4>
    ),
    h5: ({ node: _node, children, ...props }) => (
      <h5
        {...props}
        style={{
          margin: "0 0 5px",
          fontSize: typography.body,
          lineHeight: 1.35,
        }}
      >
        {renderInlineMath(children, theme)}
      </h5>
    ),
    h6: ({ node: _node, children, ...props }) => (
      <h6
        {...props}
        style={{
          margin: "0 0 5px",
          fontSize: typography.body,
          lineHeight: 1.35,
        }}
      >
        {renderInlineMath(children, theme)}
      </h6>
    ),
    ol: ({ node: _node, children, ...props }) => (
      <ol {...props} style={{ margin: "6px 0", paddingLeft: "18px" }}>
        {children}
      </ol>
    ),
    p: ({ node: _node, children, ...props }) => (
      <p {...props} style={{ margin: "0 0 6px" }}>
        {renderInlineMath(children, theme)}
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
          fontSize: typography.meta,
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
        {renderInlineMath(children, theme)}
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
        {renderInlineMath(children, theme)}
      </th>
    ),
    ul: ({ node: _node, children, ...props }) => (
      <ul {...props} style={{ margin: "6px 0", paddingLeft: "18px" }}>
        {children}
      </ul>
    ),
  };
}

function splitMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const nextMath = findNextDisplayMath(content, cursor);
    if (!nextMath) {
      pushMarkdownSegment(segments, content.slice(cursor));
      break;
    }

    pushMarkdownSegment(segments, content.slice(cursor, nextMath.start));
    segments.push({
      type: "math",
      value: normalizeMathText(nextMath.value),
      display: true,
    });
    cursor = nextMath.end;
  }

  return segments;
}

function pushMarkdownSegment(segments: MessageSegment[], value: string): void {
  if (value) {
    segments.push({ type: "markdown", value });
  }
}

function findNextDisplayMath(
  content: string,
  fromIndex: number,
): { start: number; end: number; value: string } | null {
  let index = fromIndex;
  let lineStart = index === 0 || content[index - 1] === "\n";
  let fencedCode = false;

  while (index < content.length) {
    if (lineStart && content.startsWith("```", index)) {
      fencedCode = !fencedCode;
      index += 3;
      lineStart = false;
      continue;
    }

    if (!fencedCode) {
      const dollar = readDelimitedMath(content, index, "$$", "$$");
      if (dollar) return dollar;

      const bracket = readDelimitedMath(content, index, "\\[", "\\]");
      if (bracket) return bracket;

      const equation = readDelimitedMath(
        content,
        index,
        "\\begin{equation}",
        "\\end{equation}",
      );
      if (equation) return equation;
    }

    lineStart = content[index] === "\n";
    index += 1;
  }

  return null;
}

function readDelimitedMath(
  content: string,
  start: number,
  open: string,
  close: string,
): { start: number; end: number; value: string } | null {
  if (!content.startsWith(open, start)) {
    return null;
  }

  const valueStart = start + open.length;
  const closeStart = content.indexOf(close, valueStart);
  if (closeStart < 0) {
    return null;
  }

  return {
    start,
    end: closeStart + close.length,
    value: content.slice(valueStart, closeStart).trim(),
  };
}

function splitInlineMathText(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const next = findNextInlineMath(text, cursor);
    if (!next) {
      pushMarkdownSegment(segments, text.slice(cursor));
      break;
    }

    pushMarkdownSegment(segments, text.slice(cursor, next.start));
    segments.push({
      type: "math",
      value: normalizeMathText(next.value),
      display: false,
    });
    cursor = next.end;
  }

  return segments;
}

function findNextInlineMath(
  text: string,
  fromIndex: number,
): { start: number; end: number; value: string } | null {
  let index = fromIndex;
  while (index < text.length) {
    if (
      text[index] === "$" &&
      text[index - 1] !== "\\" &&
      text[index + 1] !== "$"
    ) {
      const close = findClosingSingleDollar(text, index + 1);
      if (close >= 0) {
        return {
          start: index,
          end: close + 1,
          value: text.slice(index + 1, close),
        };
      }
    }

    if (text.startsWith("\\(", index)) {
      const close = text.indexOf("\\)", index + 2);
      if (close >= 0) {
        return {
          start: index,
          end: close + 2,
          value: text.slice(index + 2, close),
        };
      }
    }

    index += 1;
  }

  return null;
}

function findClosingSingleDollar(text: string, fromIndex: number): number {
  let index = fromIndex;
  while (index < text.length) {
    if (
      text[index] === "$" &&
      text[index - 1] !== "\\" &&
      text[index + 1] !== "$"
    ) {
      return index;
    }
    index += 1;
  }
  return -1;
}

function normalizeMathText(value: string): string {
  return value.trim().replace(/\\\\(?=[A-Za-z])/g, "\\");
}

function renderMathHtml(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      errorColor: "#b42318",
      output: "htmlAndMathml",
      strict: "warn",
      throwOnError: false,
      trust: false,
    });
  } catch {
    return "";
  }
}

function renderInlineMath(
  children: React.ReactNode,
  theme: ReturnType<typeof getSidebarTheme>,
): React.ReactNode {
  const rendered: React.ReactNode[] = [];

  React.Children.forEach(children, (child, childIndex) => {
    if (typeof child !== "string") {
      rendered.push(child);
      return;
    }

    splitInlineMathText(child).forEach((segment, segmentIndex) => {
      if (segment.type === "math") {
        rendered.push(
          <MathMessageSegment
            key={`math-${childIndex}-${segmentIndex}`}
            value={segment.value}
            display={false}
            theme={theme}
          />,
        );
      } else {
        rendered.push(segment.value);
      }
    });
  });

  return rendered;
}

const MathMessageSegment: React.FC<{
  display: boolean;
  theme: ReturnType<typeof getSidebarTheme>;
  value: string;
}> = ({ display, theme, value }) => {
  const renderedMath = renderMathHtml(value, display);

  if (display) {
    const displayStyle = {
      ...styles.mathBlock,
      background: theme.panelBackground,
      borderColor: theme.softBorder,
    };

    return renderedMath ? (
      <div
        className="ai-assistant-math-block"
        style={displayStyle}
        dangerouslySetInnerHTML={{ __html: renderedMath }}
      />
    ) : (
      <div className="ai-assistant-math-block" style={displayStyle}>
        {value}
      </div>
    );
  }

  return renderedMath ? (
    <span
      className="ai-assistant-math-inline"
      style={styles.mathInline}
      dangerouslySetInnerHTML={{ __html: renderedMath }}
    />
  ) : (
    <span className="ai-assistant-math-inline" style={styles.mathInline}>
      {value}
    </span>
  );
};

const MarkdownMessage: React.FC<{
  content: string;
  theme: ReturnType<typeof getSidebarTheme>;
}> = ({ content, theme }) => {
  const segments = splitMessageSegments(content);

  return (
    <div style={styles.content}>
      {segments.map((segment, index) =>
        segment.type === "math" ? (
          <MathMessageSegment
            key={`math-${index}`}
            value={segment.value}
            display={segment.display}
            theme={theme}
          />
        ) : (
          <ReactMarkdown
            key={`markdown-${index}`}
            components={buildMarkdownComponents(theme)}
            remarkPlugins={[remarkGfm, remarkBreaks]}
          >
            {segment.value}
          </ReactMarkdown>
        ),
      )}
    </div>
  );
};

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

const StreamingMessageBubble: React.FC<{
  message: NonNullable<ThreadViewProps["streamingMessage"]>;
  theme: ReturnType<typeof getSidebarTheme>;
}> = ({ message, theme }) => (
  <div
    style={{
      ...styles.message,
      alignSelf: "flex-start",
      background: theme.assistantMessageBackground,
      color: theme.text,
      borderColor: theme.assistantMessageBorder,
    }}
  >
    <div style={{ ...styles.streamingStatus, color: theme.mutedText }}>
      {message.statusLabel}
    </div>
    {message.reasoningContent && (
      <details open style={styles.reasoningDetails}>
        <summary style={{ ...styles.reasoningSummary, color: theme.mutedText }}>
          {isChineseLocale() ? "思考过程" : "Reasoning"}
        </summary>
        <MarkdownMessage content={message.reasoningContent} theme={theme} />
      </details>
    )}
    {message.content ? (
      <MarkdownMessage content={message.content} theme={theme} />
    ) : (
      <div style={{ ...styles.streamingPlaceholder, color: theme.mutedText }}>
        ...
      </div>
    )}
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: "none",
    overflow: "visible",
    padding: "0",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    minWidth: 0,
  },
  message: {
    maxWidth: "94%",
    minWidth: 0,
    padding: "7px 9px",
    borderRadius: "4px",
    border: "1px solid transparent",
    fontSize: typography.body,
    lineHeight: 1.4,
  },
  content: {
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
  mathBlock: {
    margin: "6px 0",
    padding: "7px 8px",
    border: "1px solid transparent",
    borderRadius: "4px",
    fontSize: typography.body,
    lineHeight: 1.45,
    overflowX: "auto",
    overflowY: "hidden",
  },
  mathInline: {
    fontSize: "1em",
    whiteSpace: "nowrap",
  },
  timestamp: {
    fontSize: typography.caption,
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
    fontSize: typography.meta,
  },
  reasoningDetails: {
    margin: "3px 0 6px",
  },
  reasoningSummary: {
    cursor: "default",
    fontSize: typography.meta,
    fontWeight: 600,
  },
  streamingPlaceholder: {
    fontSize: typography.body,
    lineHeight: 1.4,
  },
  streamingStatus: {
    fontSize: typography.meta,
    fontWeight: 600,
    marginBottom: "4px",
  },
};
