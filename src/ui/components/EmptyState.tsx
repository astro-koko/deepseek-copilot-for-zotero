import React from "react";

interface EmptyStateProps {
  hasScope: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ hasScope }) => {
  if (hasScope) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Start a conversation</div>
        <div style={styles.description}>
          Ask a question about the current paper or collection.
          <br />
          Type <kbd style={styles.kbd}>/</kbd> for quick actions like summarize or explain.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>No context selected</div>
      <div style={styles.description}>
        Select a paper, collection, or open a PDF to start chatting.
        <br />
        The AI assistant will answer based on your current selection.
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
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "8px",
    color: "#333",
  },
  description: {
    fontSize: "13px",
    lineHeight: 1.6,
  },
  kbd: {
    display: "inline-block",
    padding: "1px 4px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "3px",
    fontFamily: "monospace",
    fontSize: "12px",
  },
};
