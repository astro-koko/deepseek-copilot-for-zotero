import type { ScopeContext } from "../types/scope";

let notifierCallbackID: string | null = null;
let lastResolvedReaderTabID: string | null = null;
let lastResolvedReaderScope: ScopeContext | null = null;
let scopeRetryTimer: number | null = null;

export function resolveScopeFromReader(reader: any): ScopeContext | null {
  if (!reader || reader.type !== "pdf") return null;

  const attachmentId = reader.itemID;
  if (!attachmentId) return null;

  const item = Zotero.Items.get(attachmentId);
  if (!item) return null;

  const parentItem = item.parentItem;
  const label = parentItem
    ? parentItem.getDisplayTitle()
    : item.getDisplayTitle();

  return {
    type: "pdf",
    id: `pdf-${attachmentId}`,
    label: label || "Current PDF",
    itemIds: parentItem ? [parentItem.id] : [attachmentId],
    readerAttachmentId: attachmentId,
  };
}

export function resolveScopeFromLibrary(): ScopeContext | null {
  const win = Zotero.getMainWindow();
  if (!win) return null;

  const zp = (win as any).ZoteroPane;
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
  const mainWindow = Zotero.getMainWindow?.() as any;
  const selectedType = `${mainWindow?.Zotero_Tabs?.selectedType ?? ""}`.toLowerCase();
  const selectedTabID = `${mainWindow?.Zotero_Tabs?.selectedID ?? ""}`;
  const reader =
    isReaderTabType(selectedType) && selectedTabID
      ? Zotero.Reader.getByTabID(selectedTabID)
      : null;
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
  const selectedType = `${Zotero.getMainWindow?.()?.Zotero_Tabs?.selectedType ?? ""}`.toLowerCase();
  const selectedTabID = `${Zotero.getMainWindow?.()?.Zotero_Tabs?.selectedID ?? ""}`;
  const reader =
    isReaderTabType(selectedType) && selectedTabID
      ? Zotero.Reader.getByTabID(selectedTabID)
      : null;
  if (!reader || reader.type !== "pdf") return null;

  try {
    const primaryView = (reader as any)?._internalReader?._primaryView;
    if (primaryView?._selectionRanges?.length > 0) {
      return primaryView._selectionRanges
        .map((range: any) => range.text)
        .join("\n\n");
    }
  } catch (_e) {
    // Graceful fallback
  }
  return null;
}

function resolveScopeFromReaderTabData(
  mainWindow: any,
  selectedTabID: string,
): ScopeContext | null {
  if (!selectedTabID) {
    return null;
  }

  const tabs = Array.isArray(mainWindow?.Zotero_Tabs?._tabs)
    ? mainWindow.Zotero_Tabs._tabs
    : [];
  const activeTab = tabs.find((tab: any) => `${tab?.id ?? ""}` === selectedTabID);
  if (!activeTab) {
    return null;
  }

  const attachmentId = extractReaderAttachmentID(activeTab.data);
  if (!attachmentId) {
    return null;
  }

  const readerLike = {
    itemID: attachmentId,
    type: "pdf",
  };
  return resolveScopeFromReader(readerLike);
}

function extractReaderAttachmentID(data: any): number | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const directCandidate = toNumericID(
    data.itemID ??
      data.itemId ??
      data.attachmentID ??
      data.attachmentId ??
      data.id,
  );
  if (directCandidate) {
    return directCandidate;
  }

  for (const value of Object.values(data)) {
    const nestedCandidate = toNumericID(
      (value as any)?.itemID ??
        (value as any)?.itemId ??
        (value as any)?.attachmentID ??
        (value as any)?.attachmentId ??
        (value as any)?.id,
    );
    if (nestedCandidate) {
      return nestedCandidate;
    }
  }

  return null;
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
    notify: (event: string, type: string, ids: Array<string | number>, _extraData: any) => {
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
  const addonID = (globalThis as any)?.addon?.data?.config?.addonID;
  return addonID || "ds-copilot-scope-resolver";
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
