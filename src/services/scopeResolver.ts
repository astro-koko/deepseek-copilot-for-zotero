import type { ScopeContext, ScopeType } from "../types/scope";

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

  // Check if a collection is selected
  const collectionTree = (win as any).ZoteroPane?.collectionsView;
  if (collectionTree) {
    const selectedTreeRow = collectionTree.getRow(collectionTree.selection?.currentIndex);
    if (selectedTreeRow?.isCollection?.()) {
      const collection = selectedTreeRow.ref;
      const itemIds = collection.getChildItems(true) || [];
      return {
        type: "collection",
        id: `collection-${collection.libraryID}-${collection.key}`,
        label: collection.name,
        itemIds,
      };
    }
  }

  // Check selected items
  const selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems();
  if (!selectedItems || selectedItems.length === 0) return null;

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
  }

  // Multiple items selected
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
  // Check if reader is active
  const reader = Zotero.Reader.getByTabID(Zotero.Reader.getSelectedTabID?.() || "");
  if (reader) {
    return resolveScopeFromReader(reader);
  }

  return resolveScopeFromLibrary();
}
