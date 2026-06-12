import sidebarSource from "./Sidebar.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Sidebar recent thread layout", () => {
  it("renders a branded header icon next to the DS Copilot title", () => {
    expect(sidebarSource).toContain("headerBrand");
    expect(sidebarSource).toContain("headerBrandIcon");
    expect(sidebarSource).toContain("deepseek-favicon.png");
  });

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

  it("renders the docked composer after the scrollable viewport for active-thread states", () => {
    const scrollViewportIndex = sidebarSource.indexOf("ref={scrollViewportRef}");
    const composerDockIndex = sidebarSource.indexOf("{model.showDockedComposer && (");
    const threadSectionIndex = sidebarSource.indexOf("{model.showThreadView && (");
    const recentChatsDockIndex = sidebarSource.indexOf("{isRecentChatsVisible && (");

    expect(scrollViewportIndex).toBeGreaterThan(-1);
    expect(threadSectionIndex).toBeGreaterThan(-1);
    expect(composerDockIndex).toBeGreaterThan(-1);
    expect(recentChatsDockIndex).toBeGreaterThan(-1);
    expect(scrollViewportIndex).toBeLessThan(composerDockIndex);
    expect(threadSectionIndex).toBeLessThan(composerDockIndex);
    expect(composerDockIndex).toBeLessThan(recentChatsDockIndex);
  });

  it("uses a full-height scrollable viewport with a conditional bottom-docked composer", () => {
    expect(sidebarSource).toContain('const scrollViewportRef = useRef<HTMLDivElement>(null);');
    expect(sidebarSource).toContain('ref={scrollViewportRef}');
    expect(sidebarSource).toContain('mainPane: {');
    expect(sidebarSource).toContain('scrollViewport: {');
    expect(sidebarSource).toContain('composerDock: {');
    expect(sidebarSource).toContain('showDockedComposer');
    expect(sidebarSource).toContain('showInlineComposer');
    expect(sidebarSource).toContain('height: "100%"');
    expect(sidebarSource).toContain('overflowY: "auto"');
    expect(sidebarSource).toContain("content.scrollTop = content.scrollHeight;");
    expect(sidebarSource).not.toContain('position: "sticky"');
    expect(sidebarSource).not.toContain("composerSection:");
  });

  it("renders an inline composer above recent chats in the ready home state", () => {
    const inlineComposerIndex = sidebarSource.indexOf("{model.showInlineComposer && (");
    const recentThreadsIndex = sidebarSource.indexOf("{isRecentChatsVisible && (");

    expect(inlineComposerIndex).toBeGreaterThan(-1);
    expect(recentThreadsIndex).toBeGreaterThan(-1);
    expect(inlineComposerIndex).toBeLessThan(recentThreadsIndex);
    expect(sidebarSource).toContain("inlineComposerSection");
  });

  it("renders recent chats in a dedicated footer dock instead of the main scroll viewport", () => {
    const scrollViewportIndex = sidebarSource.indexOf("ref={scrollViewportRef}");
    const recentThreadsIndex = sidebarSource.indexOf("{isRecentChatsVisible && (");

    expect(scrollViewportIndex).toBeGreaterThan(-1);
    expect(recentThreadsIndex).toBeGreaterThan(-1);
    expect(scrollViewportIndex).toBeLessThan(recentThreadsIndex);
    expect(sidebarSource).toContain("recentChatsDock");
    expect(sidebarSource).toContain("recentChatsList");
  });

  it("gates the intro copy behind the empty-conversation state flag", () => {
    expect(sidebarSource).toContain("{model.showIntroSection && (");
    expect(sidebarSource).toContain("{model.showSuggestedActions && (");
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
