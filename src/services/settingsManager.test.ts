import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    prefMocks.getPref.mockImplementation((key: string) => prefState.get(key));
    prefMocks.setPref.mockImplementation((key: string, value: unknown) => {
      prefState.set(key, value);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("validates the API key against the DeepSeek chat endpoint", async () => {
    prefState.set("apiKey", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateSettings()).resolves.toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: "ping" }],
          stream: false,
          max_tokens: 1,
          temperature: 0,
        }),
      }),
    );
  });

  it("prefers Zotero.HTTP.request in host windows where fetch is unreliable", async () => {
    prefState.set("apiKey", "sk-test");
    const httpRequest = vi.fn().mockResolvedValue({
      status: 200,
    });
    const fetchMock = vi.fn();

    vi.stubGlobal("Zotero", {
      HTTP: {
        request: httpRequest,
      },
      getMainWindow: vi.fn(),
    } as unknown as typeof Zotero);
    vi.stubGlobal("fetch", fetchMock);

    await expect(validateSettings()).resolves.toEqual({ valid: true });
    expect(httpRequest).toHaveBeenCalledWith(
      "POST",
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: "ping" }],
          stream: false,
          max_tokens: 1,
          temperature: 0,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        responseType: "text",
        successCodes: false,
        timeout: 8000,
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Zotero.HTTP.request with the Zotero.HTTP binding intact", async () => {
    prefState.set("apiKey", "sk-test");
    const httpHost = {
      UnexpectedStatusException: function UnexpectedStatusException() {},
      request(
        this: {
          UnexpectedStatusException?: unknown;
        },
      ) {
        if (!this?.UnexpectedStatusException) {
          throw new Error(
            "Connection failed: invalid 'instanceof' operand this.UnexpectedStatusException",
          );
        }
        return Promise.resolve({ status: 200 });
      },
    };

    vi.stubGlobal("Zotero", {
      HTTP: httpHost,
      getMainWindow: vi.fn(),
    } as unknown as typeof Zotero);
    vi.stubGlobal("fetch", vi.fn());

    await expect(validateSettings()).resolves.toEqual({ valid: true });
  });

  it("maps 401 host responses to an invalid API key error", async () => {
    prefState.set("apiKey", "sk-test");
    const httpRequest = vi.fn().mockResolvedValue({
      responseText: JSON.stringify({
        error: { message: "Authentication failed" },
      }),
      status: 401,
    });

    vi.stubGlobal("Zotero", {
      HTTP: {
        request: httpRequest,
      },
      getMainWindow: vi.fn(),
    } as unknown as typeof Zotero);
    vi.stubGlobal("fetch", vi.fn());

    await expect(validateSettings()).resolves.toEqual({
      valid: false,
      error: "Invalid API key",
    });
  });

  it("returns a timeout error when Zotero.HTTP.request never resolves", async () => {
    prefState.set("apiKey", "sk-test");
    const httpRequest = vi.fn(
      () =>
        new Promise(() => {
          // Intentionally never resolves.
        }),
    );

    vi.stubGlobal("Zotero", {
      HTTP: {
        request: httpRequest,
      },
      getMainWindow: vi.fn(),
    } as unknown as typeof Zotero);
    vi.stubGlobal("fetch", vi.fn());

    const validationPromise = validateSettings();
    await vi.advanceTimersByTimeAsync(8000);

    await expect(validationPromise).resolves.toEqual({
      valid: false,
      error: "Connection failed: Timed out after 8000ms",
    });
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
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-new",
        },
        body: JSON.stringify({
          model: "deepseek-v4-pro",
          messages: [{ role: "user", content: "ping" }],
          stream: false,
          max_tokens: 1,
          temperature: 0,
        }),
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

  it("returns an inline error instead of throwing when AbortController is unavailable", async () => {
    prefState.set("apiKey", "sk-test");
    const originalAbortController = (globalThis as any).AbortController;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    (globalThis as any).AbortController = undefined;

    try {
      await expect(validateSettings()).resolves.toEqual({ valid: true });
    } finally {
      (globalThis as any).AbortController = originalAbortController;
    }
  });

  it("returns a timeout error when the provider does not respond promptly", async () => {
    prefState.set("apiKey", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves.
          }),
      ),
    );

    const validationPromise = validateSettings();
    await vi.advanceTimersByTimeAsync(8000);

    await expect(validationPromise).resolves.toEqual({
      valid: false,
      error: "Connection failed: Timed out after 8000ms",
    });
  });

  it("falls back to the Zotero main window timers when global timers are unavailable", async () => {
    prefState.set("apiKey", "sk-test");

    const originalSetTimeout = (globalThis as any).setTimeout;
    const originalClearTimeout = (globalThis as any).clearTimeout;
    const mainWindowSetTimeout = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const mainWindowClearTimeout = vi.fn();

    vi.stubGlobal(
      "Zotero",
      {
        getMainWindow: () => ({
          clearTimeout: mainWindowClearTimeout,
          setTimeout: mainWindowSetTimeout,
        }),
      } as unknown as typeof Zotero,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise(() => {
            // Intentionally never resolves.
          }),
      ),
    );
    (globalThis as any).setTimeout = undefined;
    (globalThis as any).clearTimeout = undefined;

    try {
      await expect(validateSettings()).resolves.toEqual({
        valid: false,
        error: "Connection failed: Timed out after 8000ms",
      });
      expect(mainWindowSetTimeout).toHaveBeenCalled();
      expect(mainWindowClearTimeout).toHaveBeenCalled();
    } finally {
      (globalThis as any).setTimeout = originalSetTimeout;
      (globalThis as any).clearTimeout = originalClearTimeout;
    }
  });
});
