import type { ScopeContext } from "../types/scope";
import {
  extractReaderAttachmentIDFromTabData,
  findReaderTabByID,
  getReaderCurrentPage,
  getReaderSelectedText,
} from "../modules/readerPrivate";

let notifierCallbackID: string | null = null;
let lastResolvedReaderTabID: string | null = null;
let lastResolvedReaderScope: ScopeContext | null = null;
let scopeRetryTimer: number | null = null;

type ReaderScopeLike = {
  itemID?: number;
  type?: string;
};

type ZoteroTabHostLike = Window & {
  ZoteroPane?: {
    collectionsView?: {
      getRow?: (index: unknown) => {
        isCollection?: () => boolean;
        ref?: {
          getChildItems?: (includeTrashed?: boolean) => number[] | null;
          key?: string;
          libraryID?: number;
          name?: string;
        };
      } | null;
      selection?: {
        currentIndex?: unknown;
      };
    };
    getSelectedItems?: () => Zotero.Item[];
    itemsView?: unknown;
  };
  Zotero_Tabs?: {
    _tabs?: unknown;
    selectedID?: string;
    selectedType?: string;
  };
};

export function resolveScopeFromReader(reader: ReaderScopeLike | null): ScopeContext | null {
  if (!reader || reader.type !== "pdf") return null;

  const attachmentId = reader.itemID;
  if (!attachmentId) return null;

  const item = Zotero.Items.get(attachmentId);
  if (!item) return null;

  const parentItem = item.parentItem;
  const label = parentItem
    ? parentItem.getDisplayTitle()
    : item.getDisplayTitle();
  const readerPage = getReaderCurrentPage(reader);

  return {
    type: "pdf",
    id: `pdf-${attachmentId}`,
    label: label || "Current PDF",
    itemIds: parentItem ? [parentItem.id] : [attachmentId],
    readerAttachmentId: attachmentId,
    readerPage,
  };
}

export function resolveScopeFromLibrary(): ScopeContext | null {
  const win = Zotero.getMainWindow();
  if (!win) return null;

  const zp = (win as ZoteroTabHostLike).ZoteroPane;
  if (!zp) return null;

  const itemsView = zp.itemsView;
  const collectionsView = zp.collectionsView;

  if (!itemsView || !collectionsView) return null;

  const selectedCollectionRow = collectionsView.getRow(collectionsView.selection?.currentIndex);
  const selectedItems = zp.getSelectedItems ? zp.getSelectedItems() : [];

  if (selectedItems.length === 0) {
    if (selectedCollectionRow?.isCollection?.()) {
      const collection = selectedCollectionRow.ref;
      const itemIds = collection.getChildItems ? collection.getChildItems(true) || [] : [];
      return {
        type: "collection",
        id: `collection-${collection.libraryID}-${collection.key}`,
        label: collection.name,
        itemIds,
      };
    }
    return null;
  }

  if (selectedItems.length === 1) {
    const item = selectedItems[0];
    if (item.isRegularItem()) {
      return {
        type: "paper",
        id: `paper-${item.id}`,
        label: item.getDisplayTitle(),
        itemIds: [item.id],
      };
    }

    if (
      item.isAttachment?.() &&
      item.isPDFAttachment?.() &&
      item.attachmentContentType === "application/pdf"
    ) {
      const parentItem = item.parentItem;
      const label = parentItem
        ? parentItem.getDisplayTitle()
        : item.getDisplayTitle();
      return {
        type: "pdf",
        id: `pdf-${item.id}`,
        label: label || "Current PDF",
        itemIds: parentItem ? [parentItem.id] : [item.id],
        readerAttachmentId: item.id,
      };
    }
  }

  const regularItems = selectedItems.filter((item: Zotero.Item) => item.isRegularItem());
  if (regularItems.length === 0) return null;

  return {
    type: "manual-selection",
    id: `selection-${regularItems.map((i: Zotero.Item) => i.id).join("-")}`,
    label: `${regularItems.length} items selected`,
    itemIds: regularItems.map((i: Zotero.Item) => i.id),
  };
}

export function getCurrentScope(): ScopeContext | null {
  const mainWindow = Zotero.getMainWindow?.() as ZoteroTabHostLike | null;
  const { selectedTabID, selectedType } = getSelectedTabState(mainWindow);
  const reader = getActiveReader(selectedType, selectedTabID);
  if (reader) {
    const scope = resolveScopeFromReader(reader);
    if (scope) {
      lastResolvedReaderTabID = selectedTabID;
      lastResolvedReaderScope = scope;
    }
    return scope;
  }

  const readerScopeFromTab = isReaderTabType(selectedType)
    ? resolveScopeFromReaderTabData(mainWindow, selectedTabID)
    : null;
  if (readerScopeFromTab) {
    lastResolvedReaderTabID = selectedTabID;
    lastResolvedReaderScope = readerScopeFromTab;
    return readerScopeFromTab;
  }

  if (
    isReaderTabType(selectedType) &&
    selectedTabID &&
    lastResolvedReaderTabID === selectedTabID &&
    lastResolvedReaderScope
  ) {
    return lastResolvedReaderScope;
  }

  return resolveScopeFromLibrary();
}

export function getSelectedTextFromReader(): string | null {
  const { selectedTabID, selectedType } = getSelectedTabState(
    Zotero.getMainWindow?.() as ZoteroTabHostLike | null,
  );
  const reader = getActiveReader(selectedType, selectedTabID);
  if (!reader || reader.type !== "pdf") return null;

  return getReaderSelectedText(reader);
}

function resolveScopeFromReaderTabData(
  mainWindow: ZoteroTabHostLike | null,
  selectedTabID: string,
): ScopeContext | null {
  if (!selectedTabID) {
    return null;
  }

  const activeTab = findReaderTabByID(mainWindow?.Zotero_Tabs?._tabs, selectedTabID);
  if (!activeTab) {
    return null;
  }

  const attachmentId = extractReaderAttachmentIDFromTabData(activeTab.data);
  if (!attachmentId) {
    return null;
  }

  const readerLike = {
    itemID: attachmentId,
    type: "pdf",
  };
  return resolveScopeFromReader(readerLike);
}

function toNumericID(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isReaderTabType(selectedType: string): boolean {
  return selectedType.includes("reader");
}

function getSelectedTabState(mainWindow: ZoteroTabHostLike | null): {
  selectedTabID: string;
  selectedType: string;
} {
  return {
    selectedTabID: `${mainWindow?.Zotero_Tabs?.selectedID ?? ""}`,
    selectedType: `${mainWindow?.Zotero_Tabs?.selectedType ?? ""}`.toLowerCase(),
  };
}

function getActiveReader(
  selectedType: string,
  selectedTabID: string,
): ReaderScopeLike | null {
  if (!isReaderTabType(selectedType) || !selectedTabID) {
    return null;
  }

  return Zotero.Reader.getByTabID(selectedTabID);
}

export function resetScopeResolverCacheForTests(): void {
  lastResolvedReaderTabID = null;
  lastResolvedReaderScope = null;
  clearScopeRetryTimer();
}

export function registerScopeNotifier(
  onScopeChange: (scope: ScopeContext | null) => void,
): void {
  unregisterScopeNotifier();

  const callback = {
    notify: (
      event: string,
      type: string,
      ids: Array<string | number>,
      _extraData: Record<string, unknown>,
    ) => {
      if (
        event === "select" &&
        (type === "item" ||
          type === "collection" ||
          type === "tab" ||
          type === "itempane")
      ) {
        const newScope = getCurrentScope();
        onScopeChange(newScope);
        scheduleScopeRetryIfNeeded(type, newScope, onScopeChange);
      }

      if (type === "tab" && event === "load") {
        const newScope = getCurrentScope();
        onScopeChange(newScope);
      }
    },
  };

  notifierCallbackID = Zotero.Notifier.registerObserver(callback, [
    "item",
    "collection",
    "tab",
    "itempane",
  ], getScopeObserverID());
}

export function unregisterScopeNotifier(): void {
  clearScopeRetryTimer();
  if (notifierCallbackID) {
    try {
      Zotero.Notifier.unregisterObserver(notifierCallbackID);
    } catch {
      // Ignore
    }
    notifierCallbackID = null;
  }
}

function getScopeObserverID(): string {
  const addonID = (globalThis as typeof globalThis & {
    addon?: { data?: { config?: { addonID?: string } } };
  })?.addon?.data?.config?.addonID;
  return addonID || "deepseek-copliot-scope-resolver";
}

function scheduleScopeRetryIfNeeded(
  type: string,
  scope: ScopeContext | null,
  onScopeChange: (scope: ScopeContext | null) => void,
): void {
  if (type !== "tab") {
    return;
  }

  const selectedType = `${Zotero.getMainWindow?.()?.Zotero_Tabs?.selectedType ?? ""}`.toLowerCase();
  if (!isReaderTabType(selectedType)) {
    return;
  }

  clearScopeRetryTimer();
  scopeRetryTimer = Zotero.getMainWindow()?.setTimeout(() => {
    scopeRetryTimer = null;
    onScopeChange(getCurrentScope());
  }, 150);
}

function clearScopeRetryTimer(): void {
  if (scopeRetryTimer) {
    Zotero.getMainWindow()?.clearTimeout(scopeRetryTimer);
    scopeRetryTimer = null;
  }
}
