import preferencesSource from "../../addon/content/preferences.xhtml?raw";

import { describe, expect, it } from "vitest";

describe("preferences.xhtml", () => {
  it("stays a Zotero preference fragment instead of a full XML document", () => {
    const source = preferencesSource.trimStart();

    expect(source.startsWith("<?xml")).toBe(false);
    expect(source.startsWith("<vbox")).toBe(true);
  });

  it("uses HTML inputs for editable text settings in Zotero 7", () => {
    expect(preferencesSource).toMatch(
      /<html:input[\s\S]*id="zotero-ai-assistant-pref-api-key"/,
    );
    expect(preferencesSource).not.toContain(
      '<textbox\n          id="zotero-ai-assistant-pref-api-key"',
    );
  });

  it("keeps model tuning internal while exposing hidden structured slash storage", () => {
    expect(preferencesSource).not.toContain("zotero-ai-assistant-pref-model");
    expect(preferencesSource).not.toContain(
      "zotero-ai-assistant-pref-max-context",
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-custom-presets"',
    );
  });

  it("places Commands and Prompts after web verification settings", () => {
    const evidenceIndex = preferencesSource.indexOf(
      'data-l10n-id="ai-assistant-pref-evidence-description"',
    );
    const commandsIndex = preferencesSource.indexOf(
      'data-l10n-id="ai-assistant-pref-commands-title"',
    );

    expect(evidenceIndex).toBeGreaterThanOrEqual(0);
    expect(commandsIndex).toBeGreaterThan(evidenceIndex);
  });

  it("renders a dedicated slash section without JSON command controls", () => {
    expect(preferencesSource).toContain(
      'data-l10n-id="ai-assistant-pref-slash-title"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-slash-builtins"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-slash-custom"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-slash-add"',
    );
    expect(preferencesSource).not.toContain(
      'id="zotero-ai-assistant-pref-custom-presets-import"',
    );
    expect(preferencesSource).not.toContain(
      'id="zotero-ai-assistant-pref-custom-presets-copy-ai-prompt"',
    );
    expect(preferencesSource).not.toContain(
      'id="zotero-ai-assistant-pref-custom-presets-docs-link"',
    );
  });

  it("loads the live pane through the configured Zotero addon instance", () => {
    expect(preferencesSource).toContain(
      "Zotero.ZoteroAIAssistant.hooks.onPrefsEvent",
    );
    expect(preferencesSource).not.toContain("Zotero.__addonInstance__");
  });

  it("keeps raw slash storage hidden instead of exposing a JSON editor", () => {
    const storageId = 'id="zotero-ai-assistant-pref-custom-presets"';
    const storageIdIndex = preferencesSource.indexOf(storageId);
    const storageStart = preferencesSource.lastIndexOf(
      "<html:textarea",
      storageIdIndex,
    );
    const storageEnd = preferencesSource.indexOf(
      "</html:textarea>",
      storageIdIndex,
    );
    const storageEditor = preferencesSource.slice(storageStart, storageEnd);

    expect(storageEditor).toContain("display: none");
    expect(preferencesSource).not.toContain(
      'id="zotero-ai-assistant-pref-custom-presets-import-editor"',
    );
  });

  it("uses an explicit select control for choosing the evidence provider", () => {
    expect(preferencesSource).toMatch(
      /<html:select[\s\S]*id="zotero-ai-assistant-pref-evidence-provider"/,
    );
    expect(preferencesSource).toContain('value="mcp-web-search"');
    expect(preferencesSource).toContain('value="tavily"');
    expect(preferencesSource).not.toContain("<radiogroup");
  });

  it("includes inline signup links for DeepSeek and Tavily", () => {
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-api-key-link"',
    );
    expect(preferencesSource).toContain(
      'href="https://platform.deepseek.com/"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-tavily-link"',
    );
    expect(preferencesSource).toContain('href="https://app.tavily.com/"');
  });

  it("renders Tavily as its own settings panel instead of help text only", () => {
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-tavily-settings"',
    );
    expect(preferencesSource).toContain(
      'data-l10n-id="ai-assistant-pref-tavily-settings-title"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-tavily-api-key"',
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-tavily-validate"',
    );
  });

  it("includes a debug log export action for user issue reports", () => {
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-export-debug-log"',
    );
    expect(preferencesSource).toContain(
      'data-l10n-id="ai-assistant-pref-export-debug-log"',
    );
  });
});
