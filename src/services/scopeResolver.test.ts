import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentScope,
  getSelectedTextFromReader,
  registerScopeNotifier,
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

function hostSetTimeout(callback: () => void, timeoutMs: number): unknown {
  return ((globalThis as any).setTimeout as
    | ((callback: () => void, timeoutMs: number) => unknown)
    | undefined)?.(callback, timeoutMs);
}

function hostClearTimeout(timerId: unknown): void {
  ((globalThis as any).clearTimeout as
    | ((timerId: unknown) => void)
    | undefined)?.(timerId);
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
    vi.useFakeTimers();
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
    vi.stubGlobal("addon", {
      data: {
        config: {
          addonID: "test-addon-id",
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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
      scopeKey: "pdf-22",
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
            _internalReader: {
              _primaryView: {
                _iframeWindow: {
                  PDFViewerApplication: {
                    pdfViewer: {
                      currentPageNumber: 5,
                    },
                  },
                },
              },
            },
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
      readerPage: 5,
      scopeKey: "pdf-22",
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
      scopeKey: "paper-44",
      type: "paper",
    });
  });

  it("returns no library scope while Zotero reports the collections view as unavailable", () => {
    (Zotero.getMainWindow as any).mockReturnValue({
      ZoteroPane: {
        collectionsView: false,
        getSelectedItems: () => [],
        itemsView: {},
      },
    });

    expect(resolveScopeFromLibrary()).toBeNull();
  });

  it("ignores attachment-like tab data when the selected tab is the Library", () => {
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
        _tabs: [
          {
            data: {
              id: 22,
            },
            id: "library-tab-1",
            type: "library",
          },
        ],
        selectedID: "library-tab-1",
        selectedType: "library",
      },
    });
    (Zotero.Reader.getByTabID as any).mockReturnValue(null);
    (Zotero.Items.get as any).mockImplementation((id: number) =>
      id === 22 ? staleReaderAttachment : null,
    );

    expect(getCurrentScope()).toEqual({
      id: "paper-44",
      itemIds: [44],
      label: "DEBATE",
      scopeKey: "paper-44",
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
      scopeKey: "pdf-88",
      type: "pdf",
    });

    mainWindow.Zotero_Tabs.selectedType = "reader-loading";
    (Zotero.Reader.getByTabID as any).mockReturnValue(null);

    expect(getCurrentScope()).toEqual({
      id: "pdf-88",
      itemIds: [77],
      label: "AstaBench",
      readerAttachmentId: 88,
      scopeKey: "pdf-88",
      type: "pdf",
    });
  });

  it("falls back to the selected tab data when Reader.getByTabID is not ready yet", () => {
    const parentItem = makeRegularItem(55, "Reader Warmup");
    const attachment = makePDFAttachment(66, "Reader Warmup PDF", parentItem);

    (Zotero.getMainWindow as any).mockReturnValue({
      Zotero_Tabs: {
        _tabs: [
          {
            data: {
              itemID: 66,
            },
            id: "reader-tab-data",
            type: "reader",
          },
        ],
        selectedID: "reader-tab-data",
        selectedType: "reader-preview",
      },
    });
    (Zotero.Reader.getByTabID as any).mockReturnValue(null);
    (Zotero.Items.get as any).mockImplementation((id: number) =>
      id === 66 ? attachment : null,
    );

    expect(getCurrentScope()).toEqual({
      id: "pdf-66",
      itemIds: [55],
      label: "Reader Warmup",
      readerAttachmentId: 66,
      scopeKey: "pdf-66",
      type: "pdf",
    });
  });

  it("reacts to itempane selection notifications from the live Zotero host", () => {
    const libraryItem = makeRegularItem(99, "Host Selection");
    let notifierCallback: {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: any,
      ) => void;
    } | null = null;

    (Zotero.getMainWindow as any).mockReturnValue({
      clearTimeout: hostClearTimeout,
      setTimeout: hostSetTimeout,
      ZoteroPane: {
        collectionsView: {
          getRow: vi.fn(),
          selection: {},
        },
        getSelectedItems: () => [libraryItem],
        itemsView: {},
      },
      Zotero_Tabs: {
        selectedID: "library-tab-host",
        selectedType: "library",
      },
    });
    (Zotero.Notifier.registerObserver as any).mockImplementation((callback: any) => {
      notifierCallback = callback;
      return "observer-1";
    });

    const onScopeChange = vi.fn();
    registerScopeNotifier(onScopeChange);

    if (!notifierCallback) {
      throw new Error("Expected registerScopeNotifier to install a notifier callback");
    }
    const installedNotifier: any = notifierCallback;
    installedNotifier.notify("select", "itempane", [], {});

    expect(onScopeChange).toHaveBeenCalledWith({
      id: "paper-99",
      itemIds: [99],
      label: "Host Selection",
      scopeKey: "paper-99",
      type: "paper",
    });
  });

  it("retries reader scope resolution shortly after a tab selection while Reader is still loading", () => {
    const parentItem = makeRegularItem(201, "Fresh Reader");
    const attachment = makePDFAttachment(202, "Fresh Reader PDF", parentItem);
    let notifierCallback: {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: any,
      ) => void;
    } | null = null;
    let readerLookupCount = 0;

    (Zotero.getMainWindow as any).mockReturnValue({
      clearTimeout: hostClearTimeout,
      setTimeout: hostSetTimeout,
      Zotero_Tabs: {
        _tabs: [
          {
            data: {
              itemID: 202,
            },
            id: "reader-tab-delayed",
            type: "reader",
          },
        ],
        selectedID: "reader-tab-delayed",
        selectedType: "reader",
      },
    });
    (Zotero.Notifier.registerObserver as any).mockImplementation((callback: any) => {
      notifierCallback = callback;
      return "observer-1";
    });
    (Zotero.Reader.getByTabID as any).mockImplementation(() => {
      readerLookupCount += 1;
      if (readerLookupCount === 1) {
        return null;
      }
      return {
        itemID: 202,
        type: "pdf",
      };
    });
    (Zotero.Items.get as any).mockImplementation((id: number) =>
      id === 202 ? attachment : null,
    );

    const onScopeChange = vi.fn();
    registerScopeNotifier(onScopeChange);

    if (!notifierCallback) {
      throw new Error("Expected registerScopeNotifier to install a notifier callback");
    }
    const installedNotifier: any = notifierCallback;
    installedNotifier.notify("select", "tab", ["reader-tab-delayed"], {});
    vi.runAllTimers();

    expect(onScopeChange).toHaveBeenLastCalledWith({
      id: "pdf-202",
      itemIds: [201],
      label: "Fresh Reader",
      readerAttachmentId: 202,
      scopeKey: "pdf-202",
      type: "pdf",
    });
  });

  it("retries reader scope resolution when the first tab-select pass still points at the previous PDF", () => {
    const oldParent = makeRegularItem(301, "Old Reader");
    const oldAttachment = makePDFAttachment(302, "Old Reader PDF", oldParent);
    const newParent = makeRegularItem(401, "New Reader");
    const newAttachment = makePDFAttachment(402, "New Reader PDF", newParent);
    let notifierCallback: {
      notify: (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: any,
      ) => void;
    } | null = null;

    const mainWindow = {
      clearTimeout: hostClearTimeout,
      setTimeout: hostSetTimeout,
      Zotero_Tabs: {
        _tabs: [
          {
            data: {
              itemID: 302,
            },
            id: "reader-old",
            type: "reader",
          },
        ],
        selectedID: "reader-old",
        selectedType: "reader",
      },
    };

    (Zotero.getMainWindow as any).mockReturnValue(mainWindow);
    (Zotero.Notifier.registerObserver as any).mockImplementation((callback: any) => {
      notifierCallback = callback;
      return "observer-1";
    });
    (Zotero.Reader.getByTabID as any).mockImplementation((tabID: string) => {
      if (tabID === "reader-old") {
        return {
          itemID: 302,
          type: "pdf",
        };
      }

      if (tabID === "reader-new") {
        return {
          itemID: 402,
          type: "pdf",
        };
      }

      return null;
    });
    (Zotero.Items.get as any).mockImplementation((id: number) => {
      if (id === 302) {
        return oldAttachment;
      }
      if (id === 402) {
        return newAttachment;
      }
      return null;
    });

    expect(getCurrentScope()).toEqual({
      id: "pdf-302",
      itemIds: [301],
      label: "Old Reader",
      readerAttachmentId: 302,
      scopeKey: "pdf-302",
      type: "pdf",
    });

    mainWindow.Zotero_Tabs.selectedType = "reader-loading";

    const onScopeChange = vi.fn();
    registerScopeNotifier(onScopeChange);

    if (!notifierCallback) {
      throw new Error("Expected registerScopeNotifier to install a notifier callback");
    }
    const installedNotifier: any = notifierCallback;
    installedNotifier.notify("select", "tab", ["reader-new"], {});

    expect(onScopeChange).toHaveBeenCalledWith({
      id: "pdf-302",
      itemIds: [301],
      label: "Old Reader",
      readerAttachmentId: 302,
      scopeKey: "pdf-302",
      type: "pdf",
    });

    mainWindow.Zotero_Tabs.selectedID = "reader-new";
    mainWindow.Zotero_Tabs._tabs = [
      {
        data: {
          itemID: 402,
        },
        id: "reader-new",
        type: "reader",
      },
    ];

    vi.runAllTimers();

    expect(onScopeChange).toHaveBeenLastCalledWith({
      id: "pdf-402",
      itemIds: [401],
      label: "New Reader",
      readerAttachmentId: 402,
      scopeKey: "pdf-402",
      type: "pdf",
    });
  });
});
