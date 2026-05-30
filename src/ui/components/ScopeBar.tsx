import React from "react";
import type { ScopeContext } from "../../types/scope";

interface ScopeBarProps {
  scope: ScopeContext | null;
}

export const ScopeBar: React.FC<ScopeBarProps> = ({ scope }) => {
  if (!scope) {
    return (
      <div style={styles.container}>
        <span style={styles.empty}>Select a paper or collection</span>
      </div>
    );
  }

  const scopeLabels: Record<string, string> = {
    pdf: "PDF",
    paper: "Paper",
    collection: "Collection",
    "manual-selection": "Selection",
  };

  return (
    <div style={styles.container}>
      <span style={styles.chip}>{scopeLabels[scope.type] || scope.type}</span>
      <span style={styles.label} title={scope.label}>
        {scope.label}
      </span>
      {scope.itemIds.length > 1 && (
        <span style={styles.count}>({scope.itemIds.length} items)</span>
      )}
      {scope.selectedText && (
        <span style={styles.selectedText}>Text selected</span>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderBottom: "1px solid #e0e0e0",
    fontSize: "13px",
    minHeight: "36px",
  },
  chip: {
    background: "#e3f2fd",
    color: "#1976d2",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  label: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#333",
  },
  count: {
    color: "#888",
    fontSize: "12px",
  },
  selectedText: {
    color: "#4caf50",
    fontSize: "11px",
  },
  empty: {
    color: "#888",
    fontStyle: "italic",
  },
};
