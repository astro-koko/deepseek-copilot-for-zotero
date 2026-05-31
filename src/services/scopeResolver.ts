import type { ScopeContext } from "../types/scope";

let notifierCallbackID: string | null = null;
let lastResolvedReaderTabID: string | null = null;
let lastResolvedReaderScope: ScopeContext | null = null;

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
  const selectedType = `${Zotero.getMainWindow?.()?.Zotero_Tabs?.selectedType ?? ""}`.toLowerCase();
  const selectedTabID = `${Zotero.getMainWindow?.()?.Zotero_Tabs?.selectedID ?? ""}`;
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

function isReaderTabType(selectedType: string): boolean {
  return selectedType.includes("reader");
}

export function resetScopeResolverCacheForTests(): void {
  lastResolvedReaderTabID = null;
  lastResolvedReaderScope = null;
}

export function registerScopeNotifier(
  onScopeChange: (scope: ScopeContext | null) => void,
): void {
  unregisterScopeNotifier();

  const callback = {
    notify: (event: string, type: string, ids: Array<string | number>, _extraData: any) => {
      if (
        event === "select" &&
        (type === "item" || type === "collection" || type === "tab")
      ) {
        const newScope = getCurrentScope();
        onScopeChange(newScope);
      }
    },
  };

  notifierCallbackID = Zotero.Notifier.registerObserver(callback, [
    "item",
    "collection",
    "tab",
  ], addon.data.config.addonID);
}

export function unregisterScopeNotifier(): void {
  if (notifierCallbackID) {
    try {
      Zotero.Notifier.unregisterObserver(notifierCallbackID);
    } catch {
      // Ignore
    }
    notifierCallbackID = null;
  }
}
