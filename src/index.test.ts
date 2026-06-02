import { afterEach, describe, expect, it, vi } from "vitest";

const globals = vi.hoisted(() => {
  const zotero = {} as Record<string, unknown>;

  class FakeBasicTool {
    getGlobal(name: string) {
      if (name === "Zotero") {
        return zotero;
      }
      throw new Error(`Unexpected global lookup: ${name}`);
    }
  }

  const addonInstance = {
    data: {
      ztoolkit: { ready: true },
    },
  };

  const Addon = vi.fn(() => addonInstance);

  return { zotero, FakeBasicTool, addonInstance, Addon };
});

vi.mock("zotero-plugin-toolkit", () => ({
  BasicTool: globals.FakeBasicTool,
}));

vi.mock("./addon", () => ({
  default: globals.Addon,
}));

describe("index bootstrap", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete globals.zotero.ZoteroAIAssistant;
    delete (globalThis as Record<string, unknown>).addon;
    delete (globalThis as Record<string, unknown>)._globalThis;
    delete (globalThis as Record<string, unknown>).Zotero;
  });

  it("registers the addon instance on Zotero during module bootstrap", async () => {
    (globalThis as Record<string, unknown>)._globalThis = globalThis;
    (globalThis as Record<string, unknown>).Zotero = globals.zotero;
    await import("./index");

    expect(globals.Addon).toHaveBeenCalledTimes(1);
    expect(globals.zotero.ZoteroAIAssistant).toBe(globals.addonInstance);
    expect((globalThis as Record<string, unknown>).addon).toBe(globals.addonInstance);
  });
});
