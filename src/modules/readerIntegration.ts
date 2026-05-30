/**
 * Reader integration: text selection popup and context menu.
 *
 * Registers Zotero.Reader event listeners for:
 * 1. renderTextSelectionPopup — adds "Explain" and "Ask..." buttons
 * 2. createViewContextMenu — adds "Explain Selection" and "Ask..." items
 *
 * Dispatches events via __aiAssistantEventBus so the UI can respond.
 */

let popupHandler: ((event: any) => void) | null = null;
let contextMenuHandler: ((event: any) => void) | null = null;

function dispatchReaderAction(
  action: "explain" | "ask",
  text: string,
  page: number,
  readerItemID: number,
): void {
  const win = Zotero.getMainWindow();
  const eventBus = (win as any)?.__aiAssistantEventBus;
  if (!eventBus) return;

  eventBus.dispatchEvent(
    new win.CustomEvent("readerSelectionAction", {
      detail: { action, text, page, readerItemID },
    }),
  );
}

function onRenderTextSelectionPopup(event: any): void {
  const { reader, doc, params, append } = event;

  if (reader?.type !== "pdf") return;

  const annotationText = params?.annotation?.text;
  if (!annotationText) return;

  const page = (params.annotation.pageIndex ?? 0) + 1;
  const readerItemID = reader?.itemID;
  if (!readerItemID) return;

  const container = doc.createElement("div");
  container.className = "ai-assistant-selection-popup";
  container.style.cssText = "display: flex; flex-direction: column; gap: 2px;";

  const label = doc.createElement("span");
  label.textContent = "AI Assistant";
  label.style.cssText = "font-size: 11px; color: #888; user-select: none; padding-left: 4px;";
  container.appendChild(label);

  const row = doc.createElement("div");
  row.style.cssText = "display: flex; gap: 4px;";

  const explainBtn = doc.createElement("button");
  explainBtn.className = "toolbar-button wide-button";
  explainBtn.style.cssText = "flex: 1;";
  explainBtn.textContent = "Explain";
  explainBtn.addEventListener("click", () => {
    dispatchReaderAction("explain", annotationText, page, readerItemID);
  });

  const askBtn = doc.createElement("button");
  askBtn.className = "toolbar-button wide-button";
  askBtn.style.cssText = "flex: 1;";
  askBtn.textContent = "Ask...";
  askBtn.addEventListener("click", () => {
    dispatchReaderAction("ask", annotationText, page, readerItemID);
  });

  row.appendChild(explainBtn);
  row.appendChild(askBtn);
  container.appendChild(row);
  append(container);
}

function onCreateViewContextMenu(event: any): void {
  const { reader, append } = event;

  if (reader?.type !== "pdf") return;

  const readerItemID = reader?.itemID;

  let selectedText: string | null = null;
  try {
    const primaryView = reader?._internalReader?._primaryView;
    if (primaryView?._selectionRanges?.length > 0) {
      selectedText = primaryView._selectionRanges
        .map((range: any) => range.text)
        .join("\n\n");
    }
  } catch (_e) {
    // Graceful fallback
  }

  let page = 1;
  try {
    const pdfViewer = reader?._internalReader?._primaryView
      ?._iframeWindow?.PDFViewerApplication?.pdfViewer;
    if (pdfViewer?.currentPageNumber) {
      page = pdfViewer.currentPageNumber;
    }
  } catch (_e) {
    // Fallback to page 1
  }

  const hasSelection = !!selectedText && selectedText.length > 0;

  append(
    {
      label: "Explain with AI Assistant",
      disabled: !hasSelection,
      persistent: true,
      onCommand: () => {
        if (selectedText && readerItemID) {
          dispatchReaderAction("explain", selectedText, page, readerItemID);
        }
      },
    },
    {
      label: "Ask AI Assistant...",
      disabled: !hasSelection,
      persistent: true,
      onCommand: () => {
        if (selectedText && readerItemID) {
          dispatchReaderAction("ask", selectedText, page, readerItemID);
        }
      },
    },
  );
}

function removeListenerSafely(type: string, handler: (...args: unknown[]) => unknown): boolean {
  const reader = Zotero?.Reader as any;
  const listeners = reader?._registeredListeners;
  if (!Array.isArray(listeners)) return false;
  reader._registeredListeners = listeners.filter(
    (l: any) => !(l?.type === type && l?.handler === handler),
  );
  return true;
}

export function initReaderIntegration(): void {
  if (typeof Zotero?.Reader?.registerEventListener !== "function") {
    ztoolkit.log("readerIntegration: Reader API not available, skipping");
    return;
  }

  cleanupReaderIntegration();

  popupHandler = onRenderTextSelectionPopup;
  contextMenuHandler = onCreateViewContextMenu;

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    popupHandler,
    addon.data.config.addonID,
  );
  Zotero.Reader.registerEventListener(
    "createViewContextMenu",
    contextMenuHandler,
    addon.data.config.addonID,
  );

  ztoolkit.log("readerIntegration: Registered reader event listeners");
}

export function cleanupReaderIntegration(): void {
  if (popupHandler) {
    removeListenerSafely("renderTextSelectionPopup", popupHandler);
    popupHandler = null;
  }
  if (contextMenuHandler) {
    removeListenerSafely("createViewContextMenu", contextMenuHandler);
    contextMenuHandler = null;
  }
}
