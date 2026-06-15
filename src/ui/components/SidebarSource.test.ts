import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Sidebar recent thread layout", () => {
  it("renders a branded header icon next to the Deepseek Copliot title", () => {
    expect(sidebarSource).toContain("headerBrand");
    expect(sidebarSource).toContain("headerBrandIcon");
    expect(sidebarSource).toContain("deepseek-favicon.png");
  });

  it("renders suggested actions as one compact grid instead of grouped subsections", () => {
    expect(sidebarSource).toContain("model.suggestedActions.map((action) =>");
    expect(sidebarSource).toContain("suggestedActionsGrid: {");
    expect(sidebarSource).toContain(
      'gridTemplateColumns: "repeat(2, minmax(0, 1fr))"',
    );
    expect(sidebarSource).not.toContain("suggestedActionGroups.map");
    expect(sidebarSource).not.toContain("getPresetGroupLabel(group, zh)");
  });

  it("keeps recent thread actions in their own vertical action row", () => {
    expect(sidebarSource).toContain("threadActionRow: {");
    expect(sidebarSource).toContain('display: "grid"');
    expect(sidebarSource).toContain('gridTemplateColumns: "1fr"');
    expect(sidebarSource).toContain('width: "100%"');
  });

  it("uses Zotero toolkit's native file picker before falling back during export", () => {
    const helperIndex = sidebarSource.indexOf("new FilePickerHelper(");
    const fallbackIndex = sidebarSource.indexOf("using fallback path");

    expect(sidebarSource).toContain(
      'import { FilePickerHelper } from "zotero-plugin-toolkit";',
    );
    expect(helperIndex).toBeGreaterThan(-1);
    expect(fallbackIndex).toBeGreaterThan(helperIndex);
  });

  it("uses host temp-directory helpers instead of hardcoded /tmp when picker fallback is needed", () => {
    expect(sidebarSource).toContain("PathUtils?.tempDir");
    expect(sidebarSource).toMatch(/OS[\s\S]*Constants[\s\S]*Path[\s\S]*tmpDir/);
    expect(sidebarSource).not.toContain('const fallbackPath = `/tmp/${fileName}`');
  });

  it("renders the composer in a dedicated dock after the scrollable message viewport", () => {
    const scrollViewportIndex = sidebarSource.indexOf(
      "ref={scrollViewportRef}",
    );
    const composerDockIndex = sidebarSource.indexOf("composerDock");
    const threadSectionIndex = sidebarSource.indexOf(
      "{model.showThreadView && (",
    );

    expect(scrollViewportIndex).toBeGreaterThan(-1);
    expect(threadSectionIndex).toBeGreaterThan(-1);
    expect(composerDockIndex).toBeGreaterThan(-1);
    expect(scrollViewportIndex).toBeLessThan(composerDockIndex);
    expect(threadSectionIndex).toBeLessThan(composerDockIndex);
  });

  it("uses a full-height scrollable viewport with a bottom-docked composer", () => {
    expect(sidebarSource).toContain(
      "const scrollViewportRef = useRef<HTMLDivElement>(null);",
    );
    expect(sidebarSource).toContain("ref={scrollViewportRef}");
    expect(sidebarSource).toContain("mainPane: {");
    expect(sidebarSource).toContain("scrollViewport: {");
    expect(sidebarSource).toContain("composerDock: {");
    expect(sidebarSource).toContain('height: "100%"');
    expect(sidebarSource).toContain('overflowY: "auto"');
    expect(sidebarSource).toContain(
      "content.scrollTop = content.scrollHeight;",
    );
    expect(sidebarSource).not.toContain('position: "sticky"');
    expect(sidebarSource).not.toContain("composerSection:");
  });

  it("gates the intro copy behind the empty-conversation state flag", () => {
    expect(sidebarSource).toContain("{model.showIntroSection && (");
    expect(sidebarSource).toContain("{model.showSuggestedActions && (");
  });

  it("renders the thread timestamp in a dedicated footer row instead of inside the clickable summary button", () => {
    expect(sidebarSource).toContain("<div style={styles.threadMetaRow}>");
    expect(sidebarSource).toMatch(
      /threadMetaRow:\s*\{[^}]*marginBottom: "4px"/,
    );
  });

  it("clamps recent thread title and preview text so they do not overlap actions", () => {
    expect(sidebarSource).toContain("listPrimary: {");
    expect(sidebarSource).toContain("listSecondary: {");
    expect(sidebarSource).toContain('display: "block"');
    expect(sidebarSource).toContain('maxHeight: "2.7em"');
    expect(sidebarSource).not.toContain("WebkitLineClamp: 2");
  });
});
