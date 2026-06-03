import { afterEach, describe, expect, it, vi } from "vitest";

import { applyPreset, filterPresets, getPresetsForScope } from "./presets";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presets", () => {
  it("returns an expanded Chinese reading command catalog for paper scopes", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
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

  it("applies the selected preset template without discarding existing freeform text", () => {
    vi.stubGlobal("Zotero", {
      Prefs: {
        get: vi.fn((key: string) => (key === "intl.locale.requested" ? "zh-CN" : "")),
      },
    });

    const prompt = applyPreset("summarize", "请重点看实验部分");

    expect(prompt).toContain("请用简洁的方式总结这篇论文");
    expect(prompt).not.toContain("Please provide a concise summary");
    expect(prompt).toContain("请重点看实验部分");
  });
});
