import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Sidebar recent thread layout", () => {
  it("keeps recent thread actions in their own vertical action row", () => {
    expect(sidebarSource).toContain('threadActionRow: {');
    expect(sidebarSource).toContain('display: "grid"');
    expect(sidebarSource).toContain('gridTemplateColumns: "1fr"');
    expect(sidebarSource).toContain('width: "100%"');
  });

  it("clamps recent thread title and preview text so they do not overlap actions", () => {
    expect(sidebarSource).toContain('listPrimary: {');
    expect(sidebarSource).toContain('listSecondary: {');
    expect(sidebarSource).toContain('display: "-webkit-box"');
    expect(sidebarSource).toContain('WebkitLineClamp: 2');
  });
});
