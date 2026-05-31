import React, { useEffect, useState, useRef, useCallback } from "react";
import { PRESETS, getPresetWarning, applyPreset } from "../../services/presets";
import type { ScopeType } from "../../types/scope";

interface ComposerProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  currentScopeType: ScopeType | null;
  disabled?: boolean;
  disabledReason?: string | null;
  placeholder?: string;
  draftValue?: string;
  focusNonce?: number;
  onDraftChange?: (value: string) => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onCancel,
  isStreaming,
  currentScopeType,
  disabled = false,
  disabledReason = null,
  placeholder = "Ask about this paper... (type / for presets)",
  draftValue,
  focusNonce,
  onDraftChange,
}) => {
  const [input, setInput] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (draftValue === undefined) {
      return;
    }

    setInput(draftValue);
    if (draftValue === "/") {
      setShowPresets(true);
      setSelectedPresetIndex(0);
      return;
    }

    if (!draftValue.startsWith("/")) {
      setShowPresets(false);
    }
  }, [draftValue]);

  useEffect(() => {
    if (focusNonce === undefined) {
      return;
    }

    inputRef.current?.focus();
  }, [focusNonce]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setInput("");
    onDraftChange?.("");
    setShowPresets(false);
  }, [disabled, input, isStreaming, onDraftChange, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showPresets) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedPresetIndex((i) =>
            Math.min(i + 1, PRESETS.length - 1)
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedPresetIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const preset = PRESETS[selectedPresetIndex];
          if (preset) {
            applyPresetToInput(preset.id);
          }
          return;
        }
        if (e.key === "Escape") {
          setShowPresets(false);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [showPresets, selectedPresetIndex, handleSubmit],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);
      onDraftChange?.(value);

      if (disabled) {
        setShowPresets(false);
        return;
      }

      if (value === "/") {
        setShowPresets(true);
        setSelectedPresetIndex(0);
      } else if (!value.startsWith("/")) {
        setShowPresets(false);
      }
    },
    [disabled, onDraftChange],
  );

  const applyPresetToInput = useCallback(
    (presetId: string) => {
      const warning = currentScopeType
        ? getPresetWarning(presetId, currentScopeType)
        : null;
      if (warning) {
        console.warn(warning);
      }
      const preset = PRESETS.find((p) => p.id === presetId);
      if (preset) {
        const augmented = applyPreset(preset.id, "");
        setInput(augmented);
        onDraftChange?.(augmented);
        inputRef.current?.focus();
      }
      setShowPresets(false);
    },
    [currentScopeType, onDraftChange],
  );

  return (
    <div style={styles.container}>
      {showPresets && (
        <div style={styles.presetMenu}>
          {PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              style={{
                ...styles.presetItem,
                background:
                  index === selectedPresetIndex ? "#e3f2fd" : "transparent",
              }}
              onClick={() => applyPresetToInput(preset.id)}
              onMouseEnter={() => setSelectedPresetIndex(index)}
            >
              <span style={styles.presetLabel}>/{preset.label}</span>
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
          placeholder={placeholder}
          rows={4}
          disabled={disabled}
        />
        {isStreaming ? (
          <button style={styles.cancelBtn} onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button
            style={{
              ...styles.sendBtn,
              opacity: input.trim() && !disabled ? 1 : 0.5,
            }}
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
          >
            Send
          </button>
        )}
      </div>
      {disabledReason && <div style={styles.disabledReason}>{disabledReason}</div>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #e0e0e0",
    padding: "8px 12px",
    background: "#fff",
    position: "relative",
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
    minHeight: "88px",
    maxHeight: "180px",
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
  disabledReason: {
    marginTop: "8px",
    fontSize: "12px",
    color: "#7f7461",
    lineHeight: 1.4,
  },
};
