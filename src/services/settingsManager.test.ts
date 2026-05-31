import { beforeEach, describe, expect, it, vi } from "vitest";

const prefState = new Map<string, unknown>();

const prefMocks = vi.hoisted(() => {
  const getPref = vi.fn((key: string) => prefState.get(key));
  const setPref = vi.fn((key: string, value: unknown) => {
    prefState.set(key, value);
  });

  return { getPref, setPref };
});

vi.mock("../utils/prefs", () => ({
  getPref: prefMocks.getPref,
  setPref: prefMocks.setPref,
}));

import {
  DEEPSEEK_MODELS,
  getSettings,
  saveSettings,
  validateSettings,
} from "./settingsManager";

describe("settingsManager", () => {
  beforeEach(() => {
    prefState.clear();
    vi.restoreAllMocks();
    prefMocks.getPref.mockImplementation((key: string) => prefState.get(key));
    prefMocks.setPref.mockImplementation((key: string, value: unknown) => {
      prefState.set(key, value);
    });
  });

  it("defaults to DeepSeek provider settings", () => {
    expect(DEEPSEEK_MODELS).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
    expect(getSettings()).toMatchObject({
      baseURL: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      maxContextBudget: 4000,
      keyboardShortcut: "I",
    });
  });

  it("falls back to the default DeepSeek model when the saved model is unsupported", () => {
    prefState.set("model", "deepseek-chat");

    expect(getSettings().model).toBe("deepseek-v4-flash");
  });

  it("validates the API key against the DeepSeek models endpoint", async () => {
    prefState.set("apiKey", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateSettings()).resolves.toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/models",
      expect.objectContaining({
        method: "GET",
        headers: {
          Authorization: "Bearer sk-test",
        },
      }),
    );
  });

  it("validates unsaved form values when settings are provided explicitly", async () => {
    prefState.set("apiKey", "sk-old");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateSettings({
        apiKey: "sk-new",
        model: "deepseek-v4-pro",
      }),
    ).resolves.toEqual({ valid: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/models",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer sk-new",
        },
      }),
    );
  });

  it("ignores stored base URLs and never writes them back to preferences", () => {
    prefState.set("baseURL", "https://example.com");

    expect(getSettings().baseURL).toBe("https://api.deepseek.com");

    saveSettings({
      apiKey: "sk-new",
      model: "deepseek-v4-pro",
    });

    expect(prefMocks.setPref).not.toHaveBeenCalledWith(
      "baseURL",
      expect.anything(),
    );
  });
});
