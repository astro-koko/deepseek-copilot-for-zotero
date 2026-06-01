import preferencesSource from "../../addon/content/preferences.xhtml?raw";

import { describe, expect, it } from "vitest";

describe("preferences.xhtml", () => {
  it("stays a Zotero preference fragment instead of a full XML document", () => {
    const source = preferencesSource.trimStart();

    expect(source.startsWith("<?xml")).toBe(false);
    expect(source.startsWith("<vbox")).toBe(true);
  });

  it("uses HTML inputs for editable text settings in Zotero 7", () => {
    expect(preferencesSource).toMatch(/<html:input[\s\S]*id="zotero-ai-assistant-pref-api-key"/);
    expect(preferencesSource).not.toContain('<textbox\n          id="zotero-ai-assistant-pref-api-key"');
  });

  it("keeps only the API key as a user-facing editable setting", () => {
    expect(preferencesSource).not.toContain("zotero-ai-assistant-pref-model");
    expect(preferencesSource).not.toContain("zotero-ai-assistant-pref-max-context");
  });
});
