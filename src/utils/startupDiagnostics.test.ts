import { describe, expect, it } from "vitest";

import { buildStartupDiagnostic } from "./startupDiagnostics";

describe("buildStartupDiagnostic", () => {
  it("includes the addon id and version in startup evidence", () => {
    expect(
      buildStartupDiagnostic({
        addonID: "zotero-ai-assistant@agentpaper.dev",
        stage: "startup",
        version: "0.1.0",
      }),
    ).toBe("[zotero-ai-assistant@agentpaper.dev v0.1.0] startup");
  });

  it("includes stage and detail when provided", () => {
    expect(
      buildStartupDiagnostic({
        addonID: "zotero-ai-assistant@agentpaper.dev",
        version: "0.1.0",
        stage: "sidebar-registration-failed",
        detail: "No Zotero window was available",
      }),
    ).toContain("sidebar-registration-failed :: No Zotero window was available");
  });
});
