import React from "react";
import { getSidebarTheme } from "../theme";
import { typography } from "../typography";

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as { Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } } }).Zotero?.Prefs?.get?.("intl.accept_languages", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

interface EmptyStateProps {
  hasScope: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ hasScope }) => {
  const theme = getSidebarTheme((globalThis as unknown as { window?: Window }).window);
  const zh = isChineseLocale();
  if (hasScope) {
    return (
      <div style={{ ...styles.container, color: theme.mutedText }}>
        <div style={{ ...styles.title, color: theme.text }}>
          {zh ? "开始对话" : "Start a conversation"}
        </div>
        <div style={styles.description}>
          {zh
            ? "围绕当前论文或分类提出问题。"
            : "Ask a question about the current paper or collection."}
          <br />
          {zh ? "输入 " : "Type "}
          <kbd style={{ ...styles.kbd, background: theme.panelBackground, borderColor: theme.softBorder, color: theme.text }}>/</kbd>
          {zh ? " 可快速选择总结、解释等操作。" : " for quick actions like summarize or explain."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.container, color: theme.mutedText }}>
      <div style={{ ...styles.title, color: theme.text }}>
        {zh ? "当前没有选中上下文" : "No context selected"}
      </div>
      <div style={styles.description}>
        {zh
          ? "选择一篇论文、一个分类，或打开 PDF 后开始对话。"
          : "Select a paper, collection, or open a PDF to start chatting."}
        <br />
        {zh
          ? "AI 助手会基于你当前的选中内容回答。"
          : "The AI assistant will answer based on your current selection."}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
    color: "#666",
  },
  title: {
    fontSize: typography.headingMd,
    fontWeight: 600,
    marginBottom: "8px",
    color: "#333",
  },
  description: {
    fontSize: typography.body,
    lineHeight: 1.6,
  },
  kbd: {
    display: "inline-block",
    padding: "1px 4px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "3px",
    fontFamily: "monospace",
    fontSize: typography.label,
  },
};
