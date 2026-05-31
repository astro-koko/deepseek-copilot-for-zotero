import { describe, expect, it } from "vitest";

import { buildDevServerStartArgs } from "./devServerArgs";

describe("buildDevServerStartArgs", () => {
  it("keeps the default start args when debugger is disabled", () => {
    expect(buildDevServerStartArgs(undefined)).toEqual(["-no-remote"]);
    expect(buildDevServerStartArgs(false)).toEqual(["-no-remote"]);
    expect(buildDevServerStartArgs("0")).toEqual(["-no-remote"]);
  });

  it("adds debugger flags when ZOTERO_DEBUGGER is enabled", () => {
    expect(buildDevServerStartArgs(true)).toEqual([
      "-no-remote",
      "-ZoteroDebugText",
      "-jsdebugger",
    ]);
    expect(buildDevServerStartArgs("1")).toEqual([
      "-no-remote",
      "-ZoteroDebugText",
      "-jsdebugger",
    ]);
  });
});
