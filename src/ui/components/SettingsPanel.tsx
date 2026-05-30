import React, { useState, useCallback } from "react";
import { getSettings, saveSettings, validateSettings } from "../../services/settingsManager";

interface SettingsPanelProps {
  onClose?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [settings, setSettings] = useState(getSettings());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const handleChange = useCallback((field: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(() => {
    saveSettings(settings);
    setTestResult(null);
  }, [settings]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    const result = await validateSettings();
    setTesting(false);
    setTestResult({
      valid: result.valid,
      message: result.valid ? "Connection successful!" : result.error || "Connection failed",
    });
  }, [settings]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>AI Provider Settings</h3>
        {onClose && (
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Base URL</label>
          <input
            style={styles.input}
            type="text"
            value={settings.baseURL}
            onChange={(e) => handleChange("baseURL", e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
          <div style={styles.hint}>
            Supports OpenAI, DeepSeek, SiliconFlow, and other compatible APIs.
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>API Key</label>
          <input
            style={styles.input}
            type="password"
            value={settings.apiKey}
            onChange={(e) => handleChange("apiKey", e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Model</label>
          <input
            style={styles.input}
            type="text"
            value={settings.model}
            onChange={(e) => handleChange("model", e.target.value)}
            placeholder="gpt-4o-mini"
            list="model-suggestions"
          />
          <datalist id="model-suggestions">
            <option value="gpt-4o-mini" />
            <option value="gpt-4o" />
            <option value="deepseek-chat" />
            <option value="deepseek-reasoner" />
            <option value="deepseek-ai/DeepSeek-V3" />
            <option value="deepseek-ai/DeepSeek-R1" />
          </datalist>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Max Context Budget (tokens)</label>
          <input
            style={styles.input}
            type="number"
            value={settings.maxContextBudget}
            onChange={(e) => handleChange("maxContextBudget", parseInt(e.target.value) || 4000)}
            min={1000}
            max={32000}
            step={1000}
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Keyboard Shortcut</label>
          <input
            style={{ ...styles.input, width: "60px", textAlign: "center" }}
            type="text"
            value={settings.keyboardShortcut}
            onChange={(e) => handleChange("keyboardShortcut", e.target.value.slice(0, 1).toUpperCase())}
            maxLength={1}
          />
          <span style={styles.hint}>
            Press {Zotero.isMac ? "⌘" : "Ctrl"} + {settings.keyboardShortcut} to toggle
          </span>
        </div>
      </div>

      {testResult && (
        <div style={testResult.valid ? styles.success : styles.error}>
          {testResult.message}
        </div>
      )}

      <div style={styles.actions}>
        <button
          style={styles.testBtn}
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? "Testing..." : "Test Connection"}
        </button>
        <button style={styles.saveBtn} onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    background: "#fff",
    borderTop: "1px solid #e0e0e0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#888",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "6px 10px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "inherit",
  },
  hint: {
    fontSize: "11px",
    color: "#888",
  },
  actions: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
  },
  testBtn: {
    padding: "8px 16px",
    background: "#f5f5f5",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  saveBtn: {
    padding: "8px 16px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    fontWeight: 500,
  },
  success: {
    padding: "8px 12px",
    background: "#e8f5e9",
    color: "#2e7d32",
    borderRadius: "6px",
    fontSize: "13px",
    marginTop: "12px",
  },
  error: {
    padding: "8px 12px",
    background: "#ffebee",
    color: "#c62828",
    borderRadius: "6px",
    fontSize: "13px",
    marginTop: "12px",
  },
};
