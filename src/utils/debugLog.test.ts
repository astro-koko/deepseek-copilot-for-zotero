import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDebugLog,
  createTraceId,
  debugLog,
  exportDebugLog,
  getDebugLogSnapshot,
  serializeDebugLog,
} from "./debugLog";

describe("debugLog", () => {
  beforeEach(() => {
    clearDebugLog();
    vi.unstubAllGlobals();
  });

  it("keeps only the newest entries inside the configured ring buffer", () => {
    for (let index = 0; index < 3; index += 1) {
      debugLog.info(`event.${index}`, { sequence: index }, { maxEntries: 2 });
    }

    expect(getDebugLogSnapshot().map((entry) => entry.event)).toEqual([
      "event.1",
      "event.2",
    ]);
  });

  it("generates trace ids with a readable prefix", () => {
    const traceId = createTraceId("send");

    expect(traceId).toMatch(/^send-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("serializes logs as json lines", () => {
    debugLog.info("ui.button.click", {
      action: "send",
      messageChars: 42,
      surface: "sidebar",
      traceId: "send-1",
    });
    debugLog.warn("chat.send.blocked", {
      reason: "missing-api-key",
      surface: "sidebar",
      traceId: "send-1",
    });

    const lines = serializeDebugLog().trim().split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      action: "send",
      event: "ui.button.click",
      level: "info",
      messageChars: 42,
      surface: "sidebar",
      traceId: "send-1",
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      event: "chat.send.blocked",
      level: "warn",
      reason: "missing-api-key",
    });
  });

  it("redacts secrets and content-like fields before storing entries", () => {
    debugLog.info("provider.request.start", {
      Authorization: "Bearer sk-real-secret",
      apiKey: "sk-real-secret",
      fullText: "full private pdf text",
      headers: {
        authorization: "Bearer nested-secret",
      },
      message: "private prompt",
      prompt: "private prompt",
      selectedText: "private selected text",
      userInput: "private question",
    });

    const serialized = serializeDebugLog();

    expect(serialized).not.toContain("sk-real-secret");
    expect(serialized).not.toContain("nested-secret");
    expect(serialized).not.toContain("full private pdf text");
    expect(serialized).not.toContain("private selected text");
    expect(serialized).not.toContain("private question");
    expect(serialized).toContain("[redacted]");
  });

  it("stores safe text length metadata", () => {
    debugLog.info("reader.action.dispatch", {
      messageChars: 12,
      selectedTextChars: 200,
      surface: "reader",
    });

    expect(getDebugLogSnapshot()[0]).toMatchObject({
      messageChars: 12,
      selectedTextChars: 200,
      surface: "reader",
    });
  });

  it("captures error name and message without throwing", () => {
    debugLog.error("export.file.write.error", new TypeError("disk denied"), {
      surface: "export",
    });

    expect(getDebugLogSnapshot()[0]).toMatchObject({
      errorMessage: "disk denied",
      errorName: "TypeError",
      event: "export.file.write.error",
      level: "error",
      surface: "export",
    });
  });

  it("exports the current log through the Zotero file API", async () => {
    vi.stubGlobal("Zotero", {
      File: {
        pathToFile: vi.fn((path: string) => path),
        putContentsAsync: vi.fn(async () => undefined),
      },
    });
    debugLog.info("settings.save.success", { surface: "settings" });

    await exportDebugLog("/tmp/deepseek-copliot-debug.jsonl");

    expect(Zotero.File.putContentsAsync).toHaveBeenCalledTimes(1);
    const [target, data, charset] = (
      Zotero.File.putContentsAsync as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(target).toBe("/tmp/deepseek-copliot-debug.jsonl");
    expect(String(data)).toContain("settings.save.success");
    expect(charset).toBe("utf-8");
  });

  it("falls back to the sync Zotero file API when async writes are unavailable", async () => {
    vi.stubGlobal("Zotero", {
      File: {
        pathToFile: vi.fn((path: string) => path),
        putContents: vi.fn(),
      },
    });
    debugLog.info("export.button.click", { surface: "export" });

    await exportDebugLog("/tmp/deepseek-copliot-debug.jsonl");

    expect(Zotero.File.putContents).toHaveBeenCalledTimes(1);
    const [, data] = (
      Zotero.File.putContents as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(String(data)).toContain("export.button.click");
  });

  it("does not throw when host logging fails", () => {
    vi.stubGlobal("ztoolkit", {
      log: vi.fn(() => {
        throw new Error("host logger unavailable");
      }),
    });

    expect(() => {
      debugLog.info("ui.button.click", { surface: "sidebar" });
    }).not.toThrow();
  });
});
