export function triggerToggleChat(win: Window): void {
  const libraryPane = win.document.getElementById("ai-assistant-pane-library");
  const readerPane = win.document.getElementById("ai-assistant-pane-reader");

  // Determine which pane is currently visible based on context
  const isReaderActive = !!win.document.getElementById("zotero-context-pane")?.querySelector(".reader");

  const targetPane = (isReaderActive ? readerPane : libraryPane) as HTMLElement | null;
  if (!targetPane) return;

  const isVisible = targetPane.style.display !== "none";
  targetPane.style.display = isVisible ? "none" : "flex";

  // Update toolbar button state
  const toggleBtn = win.document.getElementById("zotero-ai-assistant-tb-chat-toggle");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-pressed", String(!isVisible));
  }
}
