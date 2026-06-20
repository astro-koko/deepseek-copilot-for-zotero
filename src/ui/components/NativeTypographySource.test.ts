import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import readerIntegrationSource from "../../modules/readerIntegration.ts?raw";
import uiSource from "../ui.ts?raw";
import emptyStateSource from "./EmptyState.tsx?raw";
import scopeBarSource from "./ScopeBar.tsx?raw";
import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

const stylesSource = readFileSync(
  fileURLToPath(new URL("../../../addon/content/styles.css", import.meta.url)),
  "utf8",
);

describe("Native typography source contract", () => {
  it("removes hard-coded host typography from sidebar and empty shell surfaces", () => {
    expect(sidebarSource).not.toContain('"SF Pro Text"');
    expect(emptyStateSource).not.toContain('fontSize: "16px"');
    expect(scopeBarSource).not.toContain('fontSize: "13px"');
  });

  it("preserves popup surface inheritance hooks", () => {
    expect(stylesSource).toContain("font: inherit");
    expect(stylesSource).not.toContain("font-size: 12px");
    expect(readerIntegrationSource).not.toContain("font-size: 11px");
    expect(stylesSource).not.toMatch(
      /\.ai-assistant-selection-popup \.toolbar-button \{[\s\S]*background:/,
    );
    expect(stylesSource).not.toMatch(
      /\.ai-assistant-selection-popup \.toolbar-button:hover \{[\s\S]*background:/,
    );
    expect(readerIntegrationSource).not.toContain("color: #888");
  });

  it("removes fallback card pixel sizing from ui helpers", () => {
    expect(uiSource).not.toContain('fontSize: "14px"');
    expect(uiSource).not.toContain('fontSize: "12px"');
  });
});
