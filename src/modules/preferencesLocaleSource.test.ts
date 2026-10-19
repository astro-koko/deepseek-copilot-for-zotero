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

  it("describes web search powered by DeepSeek Search", () => {
    expect(enPreferences).toContain(
      "ai-assistant-pref-evidence-description = Enable web search in the composer to supplement answers with current information from DeepSeek Search",
    );
    expect(zhPreferences).toContain(
      "ai-assistant-pref-evidence-description = 在输入框中启用联网搜索，使用 DeepSeek Search 补充最新信息",
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
