import { describe, expect, it } from "vitest";

import { buildDevProfilePrefs } from "./devProfilePrefs";

describe("buildDevProfilePrefs", () => {
  it("maps DeepSeek and Tavily environment values into Zotero plugin prefs", () => {
    expect(
      buildDevProfilePrefs({
        env: {
          DEEPSEEK_API_KEY: "sk-dev",
          DEEPSEEK_MODEL: "deepseek-v4-pro",
          TAVILY_API_KEY: "tvly-dev",
          DS_COPILOT_EVIDENCE_ENABLED: "1",
          DS_COPILOT_EVIDENCE_PROVIDER: "tavily",
        },
        prefsPrefix: "extensions.zotero.zotero-ai-assistant",
      }),
    ).toEqual({
      "extensions.zotero.zotero-ai-assistant.apiKey": "sk-dev",
      "extensions.zotero.zotero-ai-assistant.model": "deepseek-v4-pro",
      "extensions.zotero.zotero-ai-assistant.evidenceEnabled": true,
      "extensions.zotero.zotero-ai-assistant.evidenceProviderMode": "tavily",
      "extensions.zotero.zotero-ai-assistant.tavilyApiKey": "tvly-dev",
    });
  });

  it("falls back to the new default provider when no evidence env is set", () => {
    expect(
      buildDevProfilePrefs({
        env: {},
        prefsPrefix: "extensions.zotero.zotero-ai-assistant",
      }),
    ).toEqual({});
  });
});
