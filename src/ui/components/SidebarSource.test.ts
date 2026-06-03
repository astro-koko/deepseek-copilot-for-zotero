import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Sidebar recent thread layout", () => {
  it("renders suggested actions as one compact grid instead of grouped subsections", () => {
    expect(sidebarSource).toContain("model.suggestedActions.map((action) =>");
    expect(sidebarSource).toContain('suggestedActionsGrid: {');
    expect(sidebarSource).toContain('gridTemplateColumns: "repeat(2, minmax(0, 1fr))"');
    expect(sidebarSource).not.toContain("suggestedActionGroups.map");
    expect(sidebarSource).not.toContain("getPresetGroupLabel(group, zh)");
  });

  it("keeps recent thread actions in their own vertical action row", () => {
    expect(sidebarSource).toContain('threadActionRow: {');
    expect(sidebarSource).toContain('display: "grid"');
    expect(sidebarSource).toContain('gridTemplateColumns: "1fr"');
    expect(sidebarSource).toContain('width: "100%"');
  });

  it("renders the thread timestamp in a dedicated footer row instead of inside the clickable summary button", () => {
    expect(sidebarSource).toContain('<div style={styles.threadMetaRow}>');
    expect(sidebarSource).toMatch(/threadMetaRow:\s*\{[^}]*marginBottom: "4px"/);
  });

  it("clamps recent thread title and preview text so they do not overlap actions", () => {
    expect(sidebarSource).toContain('listPrimary: {');
    expect(sidebarSource).toContain('listSecondary: {');
    expect(sidebarSource).toContain('display: "block"');
    expect(sidebarSource).toContain('maxHeight: "2.7em"');
    expect(sidebarSource).not.toContain('WebkitLineClamp: 2');
  });
});
