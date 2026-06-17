import enPreferences from "../../addon/locale/en-US/preferences.ftl?raw";
import zhPreferences from "../../addon/locale/zh-CN/preferences.ftl?raw";

import { describe, expect, it } from "vitest";

describe("preferences locale copy", () => {
  it("labels the commands and prompts section independently", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-commands-title = Commands and Prompts",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-commands-title = 命令与提示词",
    );
  });

  it("adds dedicated slash section labels", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-title = Slash Commands",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-title = Slash 命令",
    );
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-builtins-title = Built-in commands",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-builtins-title = 默认命令",
    );
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-custom-title = My commands",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-custom-title = 我的命令",
    );
    expect(enPreferences).not.toContain(
      "ai-assistant-pref-custom-presets-import = Import from JSON",
    );
    expect(zhPreferences).not.toContain(
      "ai-assistant-pref-custom-presets-import = 从 JSON 导入",
    );
  });

  it("labels custom slash add and limit copy", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-add = Add command",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-add = 新增命令",
    );
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-limit = You can add up to 10 custom commands",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-limit = 最多只能添加 10 个自定义命令",
    );
  });

  it("describes slash settings as title-and-prompt editing only", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-slash-help = Edit built-in commands or create your own commands by changing only the title and prompt text.",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-slash-help = 直接编辑默认命令，或新增自己的命令。这里只需要改标题和提示词。",
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

  it("labels the debug log export action", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-export-debug-log = Export Debug Log",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-export-debug-log = 导出调试日志",
    );
  });
});
