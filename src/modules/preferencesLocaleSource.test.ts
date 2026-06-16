import enPreferences from "../../addon/locale/en-US/preferences.ftl?raw";
import zhPreferences from "../../addon/locale/zh-CN/preferences.ftl?raw";

import { describe, expect, it } from "vitest";

describe("preferences locale copy", () => {
  it("documents the custom suggested action JSON editor", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-custom-presets-title = Custom commands",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-custom-presets-title = 自定义命令",
    );
  });

  it("labels the visual command manager explicitly", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-custom-presets-visual-title = Visual command manager",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-custom-presets-visual-title = 可视化命令管理",
    );
  });

  it("makes the default web verification path explicitly keyless", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-evidence-provider-builtin = Default web verification (recommended, no API key)",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-evidence-provider-builtin = 默认联网查证（推荐，无需 API Key）",
    );
  });

  it("makes the Tavily path explicitly require its own API key", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-evidence-provider-tavily = Tavily web verification (requires API key)",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-evidence-provider-tavily = Tavily 联网查证（需 API Key）",
    );
  });

  it("explains that Tavily fields appear only after switching providers", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-evidence-provider-help = The default web verification path does not require an API key. Switch to Tavily to reveal the Tavily API key field.",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-evidence-provider-help = 默认联网查证无需 API Key。切换到 Tavily 后，下面才会显示 Tavily API Key 输入框。",
    );
  });
});
