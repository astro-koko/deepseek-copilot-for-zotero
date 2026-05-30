import React, { useState, useRef, useCallback } from "react";
import { PRESETS, getPresetWarning, applyPreset } from "../../services/presets";
import type { ScopeType } from "../../types/scope";

interface ComposerProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  currentScopeType: ScopeType | null;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onCancel,
  isStreaming,
  currentScopeType,
}) => {
  const [input, setInput] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
    setShowPresets(false);
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);
      setShowPresets(value === "/");
    },
    [],
  );

  const applyPresetToInput = useCallback(
    (presetId: string) => {
      const warning = currentScopeType
        ? getPresetWarning(presetId, currentScopeType)
        : null;
      if (warning) {
        // In a real implementation, show a toast or inline warning
        console.warn(warning);
      }
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setInput(`/${preset.label} `);
        inputRef.current?.focus();
      }
      setShowPresets(false);
    },
    [currentScopeType],
  );

  return (
    <div style={styles.container}>
      {showPresets && (
        <div style={styles.presetMenu}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              style={styles.presetItem}
              onClick={() => applyPresetToInput(preset.id)}
            >
              <span style={styles.presetLabel}>{preset.label}</span>
              <span style={styles.presetDesc}>{preset.description}</span>
            </button>
          ))}
        </div>
      )}
      <div style={styles.inputRow}>
        <textarea
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this paper... (type / for presets)"
          rows={1}
        />
        {isStreaming ? (
          <button style={styles.cancelBtn} onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button
            style={{
              ...styles.sendBtn,
              opacity: input.trim() ? 1 : 0.5,
            }}
            onClick={handleSubmit}
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #e0e0e0",
    padding: "8px 12px",
    background: "#fff",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "14px",
    resize: "none",
    maxHeight: "120px",
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "8px 16px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
  },
  cancelBtn: {
    padding: "8px 16px",
    background: "#f5f5f5",
    color: "#d32f2f",
    border: "1px solid #ddd",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  presetMenu: {
    position: "absolute",
    bottom: "56px",
    left: "12px",
    right: "12px",
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    maxHeight: "200px",
    overflow: "auto",
    zIndex: 100,
  },
  presetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "8px 12px",
    border: "none",
    background: "none",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
  },
  presetLabel: {
    fontWeight: 600,
    fontSize: "14px",
    color: "#333",
  },
  presetDesc: {
    fontSize: "12px",
    color: "#888",
  },
};
