import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyPreset,
  expandSlashCommandInput,
  filterPresets,
  getPresetSlashCommand,
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

    expect(prompt).toContain("请面向正在读论文的研究者总结这篇论文");
    expect(prompt).not.toContain("Please provide a concise summary");
    expect(prompt).toContain("请重点看实验部分");
  });

  it("uses English preset prompts in English locales", () => {
    const prompt = applyPreset("summarize", "Focus on the experiment section");

    expect(prompt).toContain("Summarize this paper for an active researcher");
    expect(prompt).not.toContain("请用简洁的方式总结这篇论文");
  });

  it("expands exact slash commands typed into the composer input", () => {
    const prompt = expandSlashCommandInput(
      "/summarize 重点关注实验结果",
      "paper",
    );

    expect(prompt).toContain("Summarize this paper for an active researcher");
    expect(prompt).toContain("重点关注实验结果");
  });

  it("localizes built-in visible slash tokens for the Chinese locale", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) =>
          key === "intl.locale.requested" ? "zh-CN" : "",
        ),
      },
    });

    const summarize = getPresetsForScope("paper").find(
      (preset) => preset.id === "summarize",
    );

    expect(summarize?.label).toBe("总结论文");
    expect(getPresetSlashCommand(summarize!)).toBe("总结论文");
  });

  it("uses visible slash tokens instead of only internal ids", () => {
    const customPresets = JSON.stringify([
      {
        id: "future-work",
        slashCommand: "未来工作",
        label: "未来工作",
        promptPrefix: "请提出 3 个可执行的后续研究方向。",
        scopeHint: ["paper", "pdf"],
      },
    ]);

    const prompt = expandSlashCommandInput(
      "/未来工作 重点考虑实验部分",
      "paper",
      customPresets,
    );

    expect(prompt).toContain("请提出 3 个可执行的后续研究方向。");
    expect(prompt).toContain("重点考虑实验部分");
  });

  it("uses stronger built-in prompts that separate evidence from inference", () => {
    const summarize = getPresetsForScope("paper").find(
      (preset) => preset.id === "summarize",
    );
    const verify = getPresetsForScope("paper").find(
      (preset) => preset.id === "verify-claim",
    );

    expect(summarize?.promptPrefix).toContain("Distinguish");
    expect(summarize?.promptPrefix).toContain("paper directly states");
    expect(verify?.promptPrefix).toContain("external verification");
  });

  it("shows all default built-in commands in the sidebar home grid order", () => {
    expect(getSidebarPresetsForScope("paper").map((preset) => preset.id)).toEqual([
      "summarize",
      "explain",
      "core-contribution",
      "method",
      "limitations",
      "verify-claim",
      "background",
      "related-work",
    ]);
  });

  it("keeps built-in commands visible when legacy hidden tombstones exist", () => {
    const customPresets = JSON.stringify([
      {
        id: "summarize",
        hidden: true,
      },
    ]);

    expect(
      getPresetsForScope("paper", customPresets).map((preset) => preset.id),
    ).toContain("summarize");
    expect(getSidebarPresetsForScope("paper", customPresets).map((preset) => preset.id))
      .toContain("summarize");
  });

  it("keeps sidebar recommendations limited to built-in commands even when saved commands request home slots", () => {
    const customPresets = JSON.stringify([
      {
        id: "summarize",
        label: "Summarize Experiments",
        promptPrefix: "Focus on experiment design and results.",
        showInSidebar: false,
      },
      {
        id: "future-work",
        label: "Future Work",
        promptPrefix: "Suggest three concrete next studies.",
        slashCommand: "future-work",
        showInSidebar: true,
      },
    ]);

    expect(getSidebarPresetsForScope("paper", customPresets).map((preset) => preset.id)).toEqual([
      "summarize",
      "explain",
      "core-contribution",
      "method",
      "limitations",
      "verify-claim",
      "background",
      "related-work",
    ]);
  });

  it("reflects built-in title overrides in the sidebar home grid labels", () => {
    const customPresets = JSON.stringify([
      {
        id: "summarize",
        label: "总结实验",
        promptPrefix: "请重点总结实验设计和结果。",
      },
    ]);

    expect(
      getSidebarPresetsForScope("paper", customPresets).find(
        (preset) => preset.id === "summarize",
      )?.label,
    ).toBe("总结实验");
  });
});
