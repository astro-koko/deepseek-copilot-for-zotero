import type { ReaderActionDetail } from "../ui/readerActionFlow";
import { getReaderCurrentPage, getReaderSelectedText } from "./readerPrivate";
import { createTraceId, debugLog } from "../utils/debugLog";

type ReaderSelectionPopupEvent = Parameters<
  typeof Zotero.Reader.registerEventListener<"renderTextSelectionPopup">
>[1] extends (event: infer T) => unknown
  ? T
  : never;

type ReaderViewContextMenuEvent = Parameters<
  typeof Zotero.Reader.registerEventListener<"createViewContextMenu">
>[1] extends (event: infer T) => unknown
  ? T
  : never;

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as { Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } } }).Zotero?.Prefs?.get?.("intl.accept_languages", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

let popupHandler:
  | ((event: ReaderSelectionPopupEvent) => void | Promise<void>)
  | null = null;
let contextMenuHandler:
  | ((event: ReaderViewContextMenuEvent) => void | Promise<void>)
  | null = null;

function dispatchReaderAction(
  action: ReaderActionDetail["action"],
  text: string,
  page: number,
  readerItemID: number,
): void {
  const traceId = createTraceId(`reader-${action}`);
  const normalizedText = text.trim();
  const win = Zotero.getMainWindow();
  const eventBus = (win as Window & { __aiAssistantEventBus?: EventTarget } | null)
    ?.__aiAssistantEventBus;
  if (!normalizedText) {
    debugLog.warn("reader.action.blocked", {
      action,
      page,
      readerItemID,
      reason: "empty-selection",
      selectedTextChars: 0,
      surface: "reader",
      traceId,
    });
    return;
  }
  if (!eventBus) {
    debugLog.warn("reader.action.blocked", {
      action,
      page,
      readerItemID,
      reason: "missing-event-bus",
      selectedTextChars: normalizedText.length,
      surface: "reader",
      traceId,
    });
    return;
  }

  const detail: ReaderActionDetail = {
    action,
    text: normalizedText,
    page,
    readerItemID,
    traceId,
  };

  debugLog.info("reader.action.dispatch", {
    action,
    page,
    readerItemID,
    selectedTextChars: normalizedText.length,
    surface: "reader",
    traceId,
  });

  eventBus.dispatchEvent(
    new win.CustomEvent("readerSelectionAction", {
      detail,
    }),
  );
}

function onRenderTextSelectionPopup(event: ReaderSelectionPopupEvent): void {
  const { reader, doc, params, append } = event;

  if (reader?.type !== "pdf") {
    debugLog.debug("reader.popup.skip", {
      reason: "non-pdf-reader",
      readerType: String(reader?.type || ""),
      surface: "reader",
    });
    return;
  }

  const annotation = params?.annotation as
    | { pageIndex?: number; text?: string }
    | undefined;
  const annotationText = annotation?.text || "";
  if (!annotationText.trim()) {
    debugLog.warn("reader.popup.skip", {
      hasSelection: false,
      reason: "empty-annotation-text",
      readerItemID: reader?.itemID,
      selectedTextChars: 0,
      surface: "reader",
    });
    return;
  }

  const page = (annotation?.pageIndex ?? 0) + 1;
  const readerItemID = reader?.itemID;
  if (!readerItemID) {
    debugLog.warn("reader.popup.skip", {
      hasSelection: true,
      page,
      reason: "missing-reader-item-id",
      selectedTextChars: annotationText.trim().length,
      surface: "reader",
    });
    return;
  }

  debugLog.info("reader.popup.render", {
    hasSelection: true,
    page,
    readerItemID,
    selectedTextChars: annotationText.trim().length,
    surface: "reader",
  });

  const container = doc.createElement("div");
  container.className = "ai-assistant-selection-popup";
  container.style.cssText = "display: flex; flex-direction: column; gap: 2px;";
  const zh = isChineseLocale();

  const label = doc.createElement("span");
  label.textContent = "Deepseek Copliot";
  label.style.cssText = "font-size: 0.92em; color: #888; user-select: none; padding-left: 4px;";
  container.appendChild(label);

  const row = doc.createElement("div");
  row.style.cssText = "display: flex; gap: 4px;";

  const explainBtn = doc.createElement("button");
  explainBtn.className = "toolbar-button wide-button";
  explainBtn.style.cssText = "flex: 1;";
  explainBtn.textContent = zh ? "解释" : "Explain";
  explainBtn.addEventListener("click", () => {
    dispatchReaderAction("explain", annotationText, page, readerItemID);
  });

  const askBtn = doc.createElement("button");
  askBtn.className = "toolbar-button wide-button";
  askBtn.style.cssText = "flex: 1;";
  askBtn.textContent = zh ? "提问..." : "Ask...";
  askBtn.addEventListener("click", () => {
    dispatchReaderAction("ask", annotationText, page, readerItemID);
  });

  row.appendChild(explainBtn);
  row.appendChild(askBtn);
  container.appendChild(row);
  append(container);
}

function onCreateViewContextMenu(event: ReaderViewContextMenuEvent): void {
  const { reader, append } = event;

  if (reader?.type !== "pdf") {
    debugLog.debug("reader.contextMenu.skip", {
      reason: "non-pdf-reader",
      readerType: String(reader?.type || ""),
      surface: "reader",
    });
    return;
  }

  const readerItemID = reader?.itemID;

  const selectedText = getReaderSelectedText(reader);
  const page = getReaderCurrentPage(reader) ?? 1;

  const hasSelection = !!selectedText && selectedText.length > 0;
  const zh = isChineseLocale();

  debugLog.info("reader.contextMenu.create", {
    hasSelection,
    page,
    readerItemID,
    selectedTextChars: selectedText?.length || 0,
    surface: "reader",
  });

  const appendMenuItems = append as unknown as (...items: unknown[]) => void;
  appendMenuItems(
    {
      label: zh ? "用 Deepseek Copliot 解释" : "Explain with Deepseek Copliot",
      disabled: !hasSelection,
      persistent: true,
      onCommand: () => {
        if (selectedText && readerItemID) {
          dispatchReaderAction("explain", selectedText, page, readerItemID);
          return;
        }
        debugLog.warn("reader.action.blocked", {
          action: "explain",
          page,
          readerItemID,
          reason: selectedText ? "missing-reader-item-id" : "empty-selection",
          selectedTextChars: selectedText?.length || 0,
          surface: "reader",
        });
      },
    },
    {
      label: zh ? "向 Deepseek Copliot 提问..." : "Ask Deepseek Copliot...",
      disabled: !hasSelection,
      persistent: true,
      onCommand: () => {
        if (selectedText && readerItemID) {
          dispatchReaderAction("ask", selectedText, page, readerItemID);
          return;
        }
        debugLog.warn("reader.action.blocked", {
          action: "ask",
          page,
          readerItemID,
          reason: selectedText ? "missing-reader-item-id" : "empty-selection",
          selectedTextChars: selectedText?.length || 0,
          surface: "reader",
        });
      },
    },
  );
}

export function initReaderIntegration(): void {
  if (typeof Zotero?.Reader?.registerEventListener !== "function") {
    debugLog.warn("reader.integration.skip", {
      reason: "reader-api-unavailable",
      surface: "reader",
    });
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

  debugLog.info("reader.integration.registered", {
    surface: "reader",
  });
  ztoolkit.log("readerIntegration: Registered reader event listeners");
}

export function cleanupReaderIntegration(): void {
  if (popupHandler) {
    Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", popupHandler);
    popupHandler = null;
  }
  if (contextMenuHandler) {
    Zotero.Reader.unregisterEventListener("createViewContextMenu", contextMenuHandler);
    contextMenuHandler = null;
  }
}
