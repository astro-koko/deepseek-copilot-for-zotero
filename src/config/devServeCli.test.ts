import { describe, expect, it } from "vitest";

import { buildDevServeCommandForTest } from "./devServeCli";

describe("devServeCli", () => {
  it("uses the scaffold Serve API directly instead of the crashing CLI wrapper", () => {
    const command = buildDevServeCommandForTest();

    expect(command).toContain("zotero-plugin-scaffold");
    expect(command).toContain("Serve");
    expect(command).toContain("Config.loadConfig");
    expect(command).not.toContain("tiny-update-notifier");
    expect(command).not.toContain("zotero-plugin serve");
  });
});
