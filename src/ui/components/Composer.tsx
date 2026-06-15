import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  COMMAND_PRESET_GROUP_ORDER,
  applyPreset,
  expandSlashCommandInput,
  filterPresets,
  getPresetById,
  getPresetGroupLabel,
  getPresetSlashCommand,
  getPresetWarning,
  type CommandPreset,
} from "../../services/presets";
import type { ScopeType } from "../../types/scope";
import { getSidebarTheme } from "../theme";
import { typography } from "../typography";
import { isChineseLocale } from "../../utils/locale";

type ModelMode = "light" | "deep";

interface ComposerProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  onModelModeChange?: (mode: ModelMode) => void;
  onToggleEvidence?: () => void;
  isStreaming: boolean;
  currentScopeType: ScopeType | null;
  disabled?: boolean;
  disabledReason?: string | null;
  placeholder?: string;
  customPresets?: string;
  draftValue?: string;
  focusNonce?: number;
  onDraftChange?: (value: string) => void;
  modelMode?: ModelMode;
  evidenceEnabled?: boolean;
  evidenceDisabled?: boolean;
  evidenceLabel?: string;
}

function recordComposerDiagnostic(
  input: string,
  disabled: boolean,
  isStreaming: boolean,
): void {
  const diagnostics = ((
    globalThis as unknown as {
      __aiAssistantDiagnostics?: Record<string, unknown>;
    }
  ).__aiAssistantDiagnostics ??= {});

  diagnostics.composer = {
    disabled,
    input,
    isStreaming,
    sendDisabled: !input.trim() || disabled || isStreaming,
    timestamp: new Date().toISOString(),
  };
}

function readSlashQuery(value: string): string | null {
  const match = value.match(/(?:^|\s)\/([^\n]*)$/);
  if (!match) {
    return null;
  }
  return match[1] ?? "";
}

function replaceActiveSlashToken(value: string, replacement: string): string {
  return value.replace(
    /(^|\s)\/[^\n]*$/,
    (_match, leadingWhitespace: string) => {
      return `${leadingWhitespace}${replacement}`;
    },
  );
}

export const Composer: React.FC<ComposerProps> = ({
  onSend,
  onCancel,
  onModelModeChange,
  onToggleEvidence,
  isStreaming,
  currentScopeType,
  disabled = false,
  disabledReason = null,
  placeholder = "围绕这篇论文提问…（输入 / 可查看预设）",
  customPresets = "",
  draftValue,
  focusNonce,
  onDraftChange,
  modelMode = "light",
  evidenceEnabled = false,
  evidenceDisabled = false,
  evidenceLabel,
}) => {
  const [input, setInput] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const theme = getSidebarTheme(
    (globalThis as unknown as { window?: Window }).window,
  );
  const zh = isChineseLocale();
  const slashQuery = useMemo(() => readSlashQuery(input), [input]);
  const visiblePresets = useMemo(() => {
    if (!currentScopeType) {
      return [];
    }
    return filterPresets(slashQuery || "", currentScopeType, zh, customPresets);
  }, [currentScopeType, customPresets, slashQuery, zh]);
  const groupedVisiblePresets = useMemo(
    () =>
      COMMAND_PRESET_GROUP_ORDER.map((group) => ({
        group,
        presets: visiblePresets.filter((preset) => preset.group === group),
      })).filter((group) => group.presets.length > 0),
    [visiblePresets],
  );

  useEffect(() => {
    recordComposerDiagnostic(input, disabled, isStreaming);
  }, [disabled, input, isStreaming]);

  useEffect(() => {
    if (draftValue === undefined) {
      return;
    }

    setInput(draftValue);
    const nextSlashQuery = readSlashQuery(draftValue);
    if (nextSlashQuery !== null && !disabled) {
      setShowPresets(true);
      setSelectedPresetIndex(0);
      return;
    }

    setShowPresets(false);
  }, [disabled, draftValue]);

  useEffect(() => {
    if (focusNonce === undefined) {
      return;
    }

    inputRef.current?.focus();
  }, [focusNonce]);

  useEffect(() => {
    if (selectedPresetIndex >= visiblePresets.length) {
      setSelectedPresetIndex(0);
    }
  }, [selectedPresetIndex, visiblePresets.length]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || disabled) return;
    const expanded =
      currentScopeType != null
        ? expandSlashCommandInput(trimmed, currentScopeType, customPresets)
        : trimmed;
    onSend(expanded);
    setInput("");
    onDraftChange?.("");
    setShowPresets(false);
  }, [
    currentScopeType,
    customPresets,
    disabled,
    input,
    isStreaming,
    onDraftChange,
    onSend,
  ]);

  const applyPresetToInput = useCallback(
    (presetId: string) => {
      const warning = currentScopeType
        ? getPresetWarning(presetId, currentScopeType)
        : null;
      if (warning) {
        console.warn(warning);
      }

      const preset = getPresetById(presetId, customPresets);
      if (!preset) {
        return;
      }

      const replacement = applyPreset(preset.id, "", customPresets);
      const nextValue = replaceActiveSlashToken(input, replacement);
      setInput(nextValue);
      onDraftChange?.(nextValue);
      inputRef.current?.focus();
      setShowPresets(false);
    },
    [currentScopeType, customPresets, input, onDraftChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showPresets && visiblePresets.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedPresetIndex((index) =>
            Math.min(index + 1, visiblePresets.length - 1),
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedPresetIndex((index) => Math.max(index - 1, 0));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const preset = visiblePresets[selectedPresetIndex];
          if (preset) {
            applyPresetToInput(preset.id);
          }
          return;
        }
      }

      if (showPresets && e.key === "Escape") {
        e.preventDefault();
        setShowPresets(false);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      applyPresetToInput,
      handleSubmit,
      selectedPresetIndex,
      showPresets,
      visiblePresets,
    ],
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

      const nextSlashQuery = readSlashQuery(value);
      if (nextSlashQuery !== null) {
        setShowPresets(true);
        setSelectedPresetIndex(0);
      } else {
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

  const evidenceButtonLabel =
    evidenceLabel || (zh ? "联网查证" : "Web Verification");

  return (
    <div
      style={{
        ...styles.container,
        borderTopColor: theme.softBorder,
        background: theme.panelBackground,
      }}
    >
      {showPresets && visiblePresets.length > 0 && (
        <div
          style={{
            ...styles.presetMenu,
            background: theme.panelBackground,
            borderColor: theme.softBorder,
          }}
        >
          {renderPresetGroups({
            applyPresetToInput,
            groupedVisiblePresets,
            selectedPresetIndex,
            setSelectedPresetIndex,
            theme,
            zh,
          })}
        </div>
      )}

      <div style={styles.inputRow}>
        <textarea
          ref={inputRef}
          style={{
            ...styles.input,
            borderColor: theme.inputBorder,
            background: theme.inputBackground,
            color: theme.text,
          }}
          value={input}
          onChange={handleInputChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
        />
      </div>

      <div style={styles.footerRow}>
        <div style={styles.footerControls}>
          <div
            style={{
              ...styles.modelToggle,
              background: theme.panelBackground,
              borderColor: theme.buttonBorder,
            }}
          >
            <button
              style={{
                ...styles.modelToggleButton,
                color: theme.buttonText,
                background:
                  modelMode === "light"
                    ? theme.surfaceBackground
                    : "transparent",
                borderColor:
                  modelMode === "light" ? theme.buttonBorder : "transparent",
              }}
              onClick={() => onModelModeChange?.("light")}
              type="button"
            >
              {zh ? "轻度思考" : "Light"}
            </button>
            <button
              style={{
                ...styles.modelToggleButton,
                color: theme.buttonText,
                background:
                  modelMode === "deep"
                    ? theme.surfaceBackground
                    : "transparent",
                borderColor:
                  modelMode === "deep" ? theme.buttonBorder : "transparent",
              }}
              onClick={() => onModelModeChange?.("deep")}
              type="button"
            >
              {zh ? "深度思考" : "Deep"}
            </button>
          </div>

          <button
            style={{
              ...styles.evidenceButton,
              color: evidenceEnabled ? theme.badgeText : theme.buttonText,
              background: evidenceEnabled
                ? theme.badgeBackground
                : theme.surfaceBackground,
              borderColor: evidenceEnabled
                ? theme.badgeBorder
                : theme.buttonBorder,
              opacity: evidenceDisabled ? 0.55 : 1,
            }}
            disabled={evidenceDisabled}
            onClick={() => onToggleEvidence?.()}
            type="button"
          >
            {evidenceButtonLabel}
          </button>
        </div>

        {isStreaming ? (
          <button
            style={{
              ...styles.cancelBtn,
              background: theme.panelBackground,
              color: theme.errorText,
              borderColor: theme.errorBorder,
            }}
            onClick={onCancel}
            type="button"
          >
            {zh ? "停止" : "Stop"}
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
            type="button"
          >
            {zh ? "发送" : "Send"}
          </button>
        )}
      </div>

      {disabledReason && (
        <div style={{ ...styles.disabledReason, color: theme.mutedText }}>
          {disabledReason}
        </div>
      )}
    </div>
  );
};

function renderPresetGroups({
  applyPresetToInput,
  groupedVisiblePresets,
  selectedPresetIndex,
  setSelectedPresetIndex,
  theme,
  zh,
}: {
  applyPresetToInput: (presetId: string) => void;
  groupedVisiblePresets: Array<{
    group: CommandPreset["group"];
    presets: CommandPreset[];
  }>;
  selectedPresetIndex: number;
  setSelectedPresetIndex: React.Dispatch<React.SetStateAction<number>>;
  theme: ReturnType<typeof getSidebarTheme>;
  zh: boolean;
}) {
  let flatIndex = -1;

  return groupedVisiblePresets.map(({ group, presets }) => (
    <div key={group} style={styles.presetGroup}>
      <div style={{ ...styles.presetGroupLabel, color: theme.mutedText }}>
        {getPresetGroupLabel(group, zh)}
      </div>
      {presets.map((preset) => {
        flatIndex += 1;
        const presetIndex = flatIndex;
        return (
          <button
            key={preset.id}
            style={{
              ...styles.presetItem,
              background:
                presetIndex === selectedPresetIndex
                  ? theme.userMessageBackground
                  : "transparent",
            }}
            onClick={() => applyPresetToInput(preset.id)}
            onMouseEnter={() => setSelectedPresetIndex(presetIndex)}
          >
            <span style={{ ...styles.presetLabel, color: theme.text }}>
              /{getPresetSlashCommand(preset)}
            </span>
            <span style={{ ...styles.presetDesc, color: theme.mutedText }}>
              {preset.label} · {preset.description}
            </span>
          </button>
        );
      })}
    </div>
  ));
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: "1px solid #dddddd",
    padding: "8px 10px",
    background: "#f6f6f6",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  inputRow: {
    display: "flex",
    gap: "5px",
    alignItems: "flex-end",
    flexWrap: "wrap",
    minWidth: 0,
    width: "100%",
  },
  input: {
    flex: "1 1 180px",
    minWidth: 0,
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #d4d4d4",
    borderRadius: "6px",
    fontSize: typography.body,
    resize: "none",
    minHeight: "56px",
    maxHeight: "140px",
    fontFamily: "inherit",
    background: "#fff",
    color: "#222",
    boxSizing: "border-box",
  },
  footerRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  footerControls: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  modelToggle: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    border: "1px solid #c9c9c9",
    borderRadius: "6px",
    padding: "2px",
    gap: "2px",
    minWidth: 0,
  },
  modelToggleButton: {
    appearance: "none",
    border: "1px solid transparent",
    borderRadius: "4px",
    padding: "4px 8px",
    fontSize: typography.label,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  evidenceButton: {
    appearance: "none",
    border: "1px solid #c9c9c9",
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: typography.meta,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: "#ffffff",
  },
  sendBtn: {
    flexShrink: 0,
    padding: "5px 10px",
    background: "#ffffff",
    color: "#333",
    border: "1px solid #cfcfcf",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: typography.body,
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  cancelBtn: {
    flexShrink: 0,
    padding: "5px 10px",
    background: "#f7f7f7",
    color: "#8a3a3a",
    border: "1px solid #d3c2c2",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: typography.body,
    whiteSpace: "nowrap",
  },
  presetMenu: {
    position: "absolute",
    bottom: "110px",
    left: "10px",
    right: "10px",
    background: "#fff",
    border: "1px solid #d8d8d8",
    borderRadius: "6px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    maxHeight: "220px",
    overflow: "auto",
    zIndex: 100,
  },
  presetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "7px 9px",
    border: "none",
    background: "none",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
  },
  presetGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px 0",
  },
  presetGroupLabel: {
    fontSize: typography.caption,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: "0 9px",
  },
  presetLabel: {
    fontWeight: 600,
    fontSize: typography.body,
    color: "#333",
  },
  presetDesc: {
    fontSize: typography.meta,
    color: "#777",
  },
  disabledReason: {
    marginTop: "2px",
    fontSize: typography.meta,
    color: "#6c6c6c",
    lineHeight: 1.4,
  },
};
