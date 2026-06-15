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

  it("keeps model tuning internal while exposing custom suggested actions", () => {
    expect(preferencesSource).not.toContain("zotero-ai-assistant-pref-model");
    expect(preferencesSource).not.toContain(
      "zotero-ai-assistant-pref-max-context",
    );
    expect(preferencesSource).toContain(
      'id="zotero-ai-assistant-pref-custom-presets"',
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
});
