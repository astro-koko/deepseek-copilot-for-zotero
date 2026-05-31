import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentScope,
  getSelectedTextFromReader,
  resetScopeResolverCacheForTests,
  resolveScopeFromLibrary,
} from "./scopeResolver";

interface FakeItem {
  attachmentContentType?: string;
  getDisplayTitle: () => string;
  id: number;
  isAttachment?: () => boolean;
  isPDFAttachment?: () => boolean;
  isRegularItem: () => boolean;
  parentItem?: FakeItem | null;
}

function makeRegularItem(id: number, title: string): FakeItem {
  return {
    getDisplayTitle: () => title,
    id,
    isRegularItem: () => true,
    parentItem: null,
  };
}

function makePDFAttachment(
  id: number,
  title: string,
  parentItem?: FakeItem | null,
): FakeItem {
  return {
    attachmentContentType: "application/pdf",
    getDisplayTitle: () => title,
    id,
    isAttachment: () => true,
    isPDFAttachment: () => true,
    isRegularItem: () => false,
    parentItem: parentItem ?? null,
  };
}

describe("scopeResolver", () => {
  beforeEach(() => {
    resetScopeResolverCacheForTests();
    vi.unstubAllGlobals();
    vi.stubGlobal("Zotero", {
      Items: {
        get: vi.fn(),
      },
      Notifier: {
        registerObserver: vi.fn(),
        unregisterObserver: vi.fn(),
      },
      Reader: {
        getByTabID: vi.fn(),
      },
      getMainWindow: vi.fn(),
    });
  });

  it("treats a selected PDF attachment in Library as a supported pdf scope", () => {
    const parentItem = makeRegularItem(11, "AutoScientists");
    const attachment = makePDFAttachment(22, "AutoScientists PDF", parentItem);

    (Zotero.getMainWindow as any).mockReturnValue({
      ZoteroPane: {
        collectionsView: {
          getRow: vi.fn(),
          selection: {},
        },
        getSelectedItems: () => [attachment],
        itemsView: {},
      },
    });

    expect(resolveScopeFromLibrary()).toEqual({
      id: "pdf-22",
      itemIds: [11],
      label: "AutoScientists",
      readerAttachmentId: 22,
      type: "pdf",
    });
  });

  it("resolves reader scope from the selected Zotero tab id when a PDF reader tab is active", () => {
    const parentItem = makeRegularItem(11, "AutoScientists");
    const attachment = makePDFAttachment(22, "AutoScientists PDF", parentItem);

    (Zotero.getMainWindow as any).mockReturnValue({
      Zotero_Tabs: {
        selectedID: "reader-tab-1",
        selectedType: "reader",
      },
    });
    (Zotero.Reader.getByTabID as any).mockImplementation((tabID: string) =>
      tabID === "reader-tab-1"
        ? {
            itemID: 22,
            type: "pdf",
          }
        : null,
    );
    (Zotero.Items.get as any).mockReturnValue(attachment);

    expect(getCurrentScope()).toEqual({
      id: "pdf-22",
      itemIds: [11],
      label: "AutoScientists",
      readerAttachmentId: 22,
      type: "pdf",
    });
  });

  it("prefers Library scope when the selected tab is not a reader even if a reader lookup would return data", () => {
    const libraryItem = makeRegularItem(44, "DEBATE");
    const staleReaderParent = makeRegularItem(11, "AutoScientists");
    const staleReaderAttachment = makePDFAttachment(
      22,
      "AutoScientists PDF",
      staleReaderParent,
    );

    (Zotero.getMainWindow as any).mockReturnValue({
      ZoteroPane: {
        collectionsView: {
          getRow: vi.fn(),
          selection: {},
        },
        getSelectedItems: () => [libraryItem],
        itemsView: {},
      },
      Zotero_Tabs: {
        selectedID: "library-tab-1",
        selectedType: "library",
      },
    });
    (Zotero.Reader.getByTabID as any).mockReturnValue({
      itemID: 22,
      type: "pdf",
    });
    (Zotero.Items.get as any).mockImplementation((id: number) =>
      id === 22 ? staleReaderAttachment : null,
    );

    expect(getCurrentScope()).toEqual({
      id: "paper-44",
      itemIds: [44],
      label: "DEBATE",
      type: "paper",
    });
  });

  it("reads selected reader text from the active Zotero tab id", () => {
    (Zotero.getMainWindow as any).mockReturnValue({
      Zotero_Tabs: {
        selectedID: "reader-tab-2",
        selectedType: "reader-preview",
      },
    });
    (Zotero.Reader.getByTabID as any).mockReturnValue({
      _internalReader: {
        _primaryView: {
          _selectionRanges: [{ text: "First chunk" }, { text: "Second chunk" }],
        },
      },
      type: "pdf",
    });

    expect(getSelectedTextFromReader()).toBe("First chunk\n\nSecond chunk");
  });

  it("keeps resolving reader scope while Zotero reports a reader-loading tab type", () => {
    const parentItem = makeRegularItem(77, "AstaBench");
    const attachment = makePDFAttachment(88, "AstaBench PDF", parentItem);
    const mainWindow = {
      Zotero_Tabs: {
        selectedID: "reader-tab-loading",
        selectedType: "reader",
      },
    };

    (Zotero.getMainWindow as any).mockReturnValue(mainWindow);
    (Zotero.Reader.getByTabID as any).mockImplementation((tabID: string) =>
      tabID === "reader-tab-loading"
        ? {
            itemID: 88,
            type: "pdf",
          }
        : null,
    );
    (Zotero.Items.get as any).mockReturnValue(attachment);

    expect(getCurrentScope()).toEqual({
      id: "pdf-88",
      itemIds: [77],
      label: "AstaBench",
      readerAttachmentId: 88,
      type: "pdf",
    });

    mainWindow.Zotero_Tabs.selectedType = "reader-loading";
    (Zotero.Reader.getByTabID as any).mockReturnValue(null);

    expect(getCurrentScope()).toEqual({
      id: "pdf-88",
      itemIds: [77],
      label: "AstaBench",
      readerAttachmentId: 88,
      type: "pdf",
    });
  });
});
