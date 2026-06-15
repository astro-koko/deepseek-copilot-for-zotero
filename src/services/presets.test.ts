import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyPreset,
  expandSlashCommandInput,
  filterPresets,
  getSidebarPresetsForScope,
  getPresetsForScope,
} from "./presets";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presets", () => {
  it("returns an expanded Chinese reading command catalog for paper scopes", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) =>
          key === "intl.locale.requested" ? "zh-CN" : "",
        ),
      },
    });

    const presets = getPresetsForScope("paper");

    expect(presets).toHaveLength(8);
    expect(presets.map((preset) => preset.label)).toEqual(
      expect.arrayContaining(["总结论文", "通俗解释", "核心贡献", "查证结论"]),
    );
  });

  it("filters presets by Chinese label and aliases", () => {
    const filtered = filterPresets("查证", "paper", true);

    expect(filtered.map((preset) => preset.id)).toContain("verify-claim");
  });

  it("merges custom suggested action replacements and additions", () => {
    const customPresets = JSON.stringify([
      {
        id: "summarize",
        aliases: ["实验总结"],
        label: "总结实验",
        promptPrefix: "请重点总结实验设计和结果。",
      },
      {
        id: "future-work",
        label: "未来工作",
        description: "提出后续研究方向",
        promptPrefix: "请提出 3 个可执行的后续研究方向。",
        aliases: ["后续", "future"],
        scopeHint: ["paper", "pdf"],
      },
    ]);

    const presets = getPresetsForScope("paper", customPresets);

    expect(presets.find((preset) => preset.id === "summarize")).toMatchObject({
      label: "总结实验",
      promptPrefix: "请重点总结实验设计和结果。",
    });
    expect(presets.map((preset) => preset.id)).toContain("future-work");
    expect(
      filterPresets("后续", "paper", true, customPresets).map(
        (preset) => preset.id,
      ),
    ).toContain("future-work");
  });

  it("applies the selected preset template without discarding existing freeform text", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) =>
          key === "intl.locale.requested" ? "zh-CN" : "",
        ),
      },
    });

    const prompt = applyPreset("summarize", "请重点看实验部分");

    expect(prompt).toContain("请用简洁的方式总结这篇论文");
    expect(prompt).not.toContain("Please provide a concise summary");
    expect(prompt).toContain("请重点看实验部分");
  });

  it("uses English preset prompts in English locales", () => {
    const prompt = applyPreset("summarize", "Focus on the experiment section");

    expect(prompt).toContain("Please provide a concise summary of this paper.");
    expect(prompt).not.toContain("请用简洁的方式总结这篇论文");
  });

  it("expands exact slash commands typed into the composer input", () => {
    const prompt = expandSlashCommandInput(
      "/summarize 重点关注实验结果",
      "paper",
    );

    expect(prompt).toContain("Please provide a concise summary of this paper.");
    expect(prompt).toContain("重点关注实验结果");
  });

  it("limits sidebar presets to the fixed high-frequency commands", () => {
    expect(getSidebarPresetsForScope("paper").map((preset) => preset.id)).toEqual([
      "summarize",
      "explain",
      "core-contribution",
      "limitations",
    ]);
  });

  it("removes hidden built-in commands from both slash and sidebar catalogs", () => {
    const customPresets = JSON.stringify([
      {
        id: "summarize",
        hidden: true,
      },
    ]);

    expect(
      getPresetsForScope("paper", customPresets).map((preset) => preset.id),
    ).not.toContain("summarize");
    expect(
      getSidebarPresetsForScope("paper", customPresets).map(
        (preset) => preset.id,
      ),
    ).not.toContain("summarize");
  });
});
