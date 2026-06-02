import React, { useEffect, useState, useRef, useCallback } from "react";
import { PRESETS, getPresetWarning, applyPreset } from "../../services/presets";
import type { ScopeType } from "../../types/scope";
import { getSidebarTheme } from "../theme";

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

function recordComposerDiagnostic(
  input: string,
  disabled: boolean,
  isStreaming: boolean,
): void {
  const diagnostics = ((globalThis as unknown as {
    __aiAssistantDiagnostics?: Record<string, unknown>;
  }).__aiAssistantDiagnostics ??= {});

  diagnostics.composer = {
    disabled,
    input,
    isStreaming,
    sendDisabled: !input.trim() || disabled || isStreaming,
    timestamp: new Date().toISOString(),
  };
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
  const theme = getSidebarTheme((globalThis as unknown as { window?: Window }).window);
  const zh = isChineseLocale();

  useEffect(() => {
    recordComposerDiagnostic(input, disabled, isStreaming);
  }, [disabled, input, isStreaming]);

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

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const value = e.currentTarget.value;
      setInput((current) => (current === value ? current : value));
      onDraftChange?.(value);
    },
    [onDraftChange],
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
    <div style={{ ...styles.container, borderTopColor: theme.softBorder, background: theme.panelBackground }}>
      {showPresets && (
        <div style={{ ...styles.presetMenu, background: theme.panelBackground, borderColor: theme.softBorder }}>
          {PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              style={{
                ...styles.presetItem,
                background:
                  index === selectedPresetIndex ? theme.userMessageBackground : "transparent",
              }}
              onClick={() => applyPresetToInput(preset.id)}
              onMouseEnter={() => setSelectedPresetIndex(index)}
            >
              <span style={{ ...styles.presetLabel, color: theme.text }}>/{preset.label}</span>
              <span style={{ ...styles.presetDesc, color: theme.mutedText }}>{preset.description}</span>
            </button>
          ))}
        </div>
      )}
      <div style={styles.inputRow}>
        <textarea
          ref={inputRef}
          style={{ ...styles.input, borderColor: theme.inputBorder, background: theme.inputBackground, color: theme.text }}
          value={input}
          onChange={handleInputChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
        />
        {isStreaming ? (
          <button
            style={{ ...styles.cancelBtn, background: theme.panelBackground, color: theme.errorText, borderColor: theme.errorBorder }}
            onClick={onCancel}
          >
            Stop
          </button>
        ) : (
          <button
            style={{
              ...styles.sendBtn,
              background: theme.surfaceBackground,
              color: theme.buttonText,
              borderColor: theme.buttonBorder,
              opacity: input.trim() && !disabled ? 1 : 0.5,
            }}
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
          >
            {zh ? "发送" : "Send"}
          </button>
        )}
      </div>
      {disabledReason && (
        <div style={{ ...styles.disabledReason, color: theme.mutedText }}>{disabledReason}</div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #dddddd",
    padding: "7px 10px",
    background: "#f6f6f6",
    position: "relative",
  },
  inputRow: {
    display: "flex",
    gap: "5px",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    padding: "5px 7px",
    border: "1px solid #d4d4d4",
    borderRadius: "4px",
    fontSize: "12px",
    resize: "none",
    minHeight: "52px",
    maxHeight: "120px",
    fontFamily: "inherit",
    background: "#fff",
    color: "#222",
  },
  sendBtn: {
    padding: "5px 9px",
    background: "#ffffff",
    color: "#333",
    border: "1px solid #cfcfcf",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  },
  cancelBtn: {
    padding: "5px 9px",
    background: "#f7f7f7",
    color: "#8a3a3a",
    border: "1px solid #d3c2c2",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
  },
  presetMenu: {
    position: "absolute",
    bottom: "44px",
    left: "10px",
    right: "10px",
    background: "#fff",
    border: "1px solid #d8d8d8",
    borderRadius: "4px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    maxHeight: "180px",
    overflow: "auto",
    zIndex: 100,
  },
  presetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "6px 8px",
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
    marginTop: "5px",
    fontSize: "11px",
    color: "#6c6c6c",
    lineHeight: 1.4,
  },
};
