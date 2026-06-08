import stylesSource from "../../../addon/content/styles.css?raw";
import readerIntegrationSource from "../../modules/readerIntegration.ts?raw";
import uiSource from "../ui.ts?raw";
import emptyStateSource from "./EmptyState.tsx?raw";
import scopeBarSource from "./ScopeBar.tsx?raw";
import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Native typography source contract", () => {
  it("removes hard-coded host typography and preserves inheritance hooks", () => {
    expect(sidebarSource).not.toContain('"SF Pro Text"');
    expect(emptyStateSource).not.toContain('fontSize: "16px"');
    expect(scopeBarSource).not.toContain('fontSize: "13px"');
    expect(stylesSource).toContain("font: inherit");
    expect(stylesSource).not.toContain("font-size: 12px");
    expect(readerIntegrationSource).not.toContain("font-size: 11px");
    expect(uiSource).not.toContain('fontSize: "14px"');
    expect(uiSource).not.toContain('fontSize: "12px"');
  });
});
