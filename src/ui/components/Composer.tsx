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
                  index === selectedPresetIndex ? "#f1f4f7" : "transparent",
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
    borderTop: "1px solid #dcdcdc",
    padding: "8px 10px",
    background: "#f3f3f3",
    position: "relative",
  },
  inputRow: {
    display: "flex",
    gap: "6px",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    padding: "6px 8px",
    border: "1px solid #cfcfcf",
    borderRadius: "6px",
    fontSize: "12px",
    resize: "none",
    minHeight: "64px",
    maxHeight: "140px",
    fontFamily: "inherit",
    background: "#fff",
    color: "#222",
  },
  sendBtn: {
    padding: "6px 10px",
    background: "#fdfdfd",
    color: "#333",
    border: "1px solid #c9c9c9",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  },
  cancelBtn: {
    padding: "6px 10px",
    background: "#f7f7f7",
    color: "#8a3a3a",
    border: "1px solid #d3c2c2",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
  },
  presetMenu: {
    position: "absolute",
    bottom: "48px",
    left: "10px",
    right: "10px",
    background: "#fff",
    border: "1px solid #d6d6d6",
    borderRadius: "6px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    maxHeight: "200px",
    overflow: "auto",
    zIndex: 100,
  },
  presetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "7px 10px",
    border: "none",
    background: "none",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
  },
  presetLabel: {
    fontWeight: 600,
    fontSize: "12px",
    color: "#333",
  },
  presetDesc: {
    fontSize: "11px",
    color: "#777",
  },
  disabledReason: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#6c6c6c",
    lineHeight: 1.4,
  },
};
