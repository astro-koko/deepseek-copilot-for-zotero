import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sidebarVisible: vi.fn(() => true),
  registerSidebarRefreshHandler: vi.fn(() => vi.fn()),
  setSidebarVisible: vi.fn(),
  eventBusDispatchEvent: vi.fn(),
  eventBusGetInstance: vi.fn(() => ({
    addEventListener() {},
    dispatchEvent: mocks.eventBusDispatchEvent,
    removeEventListener() {},
  })),
  getPref: vi.fn(() => "I"),
  getCurrentScope: vi.fn(() => ({
    id: "paper-17",
    itemIds: [17],
    label: "Scope Probe",
    type: "paper",
  })),
  registerObserver: vi.fn(() => "tab-observer-id"),
  unregisterObserver: vi.fn(),
  createRoot: vi.fn(),
  reactDomImport: vi.fn(),
}));

vi.mock(import("react-dom/client"), async () => {
  const actual =
    await vi.importActual<typeof import("react-dom/client")>(
      "react-dom/client",
    );
  return {
    ...actual,
    createRoot: mocks.createRoot,
  };
});

vi.mock("../utils/eventBus", () => ({
  EventBus: {
    getInstance: mocks.eventBusGetInstance,
  },
}));

vi.mock("../utils/locale", () => ({
  getLocaleID: (id: string) => id,
}));

vi.mock("../utils/prefs", () => ({
  getPref: mocks.getPref,
}));

vi.mock("./sidebarRuntime", () => ({
  isSidebarVisible: mocks.sidebarVisible,
  registerSidebarRefreshHandler: mocks.registerSidebarRefreshHandler,
  setSidebarVisible: mocks.setSidebarVisible,
}));

vi.mock("../services/scopeResolver", () => ({
  getCurrentScope: mocks.getCurrentScope,
}));

import { UIFactory } from "./ui";

class FakeElement {
  private _id = "";
  className = "";
  textContent = "";
  parentElement: FakeElement | null = null;
  parentNode: FakeElement | null = null;
  ownerDocument!: FakeDocument;
  children: FakeElement[] = [];
  dataset: Record<string, string> = {};
  style = {
    display: "",
    cssText: "",
    removeProperty: (name: string) => {
      delete (this.style as Record<string, unknown>)[name];
    },
  } as Record<string, any>;
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor(private readonly tagName = "div") {}

  get id() {
    return this._id;
  }

  set id(value: string) {
    if (this._id && this.ownerDocument) {
      this.ownerDocument.unregister(this._id, this);
    }
    this._id = value;
    this.ownerDocument?.register(this);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "id") {
      this.id = value;
      return;
    }
    if (name === "class") {
      this.className = value;
      return;
    }
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  appendChild(child: unknown) {
    const node = child as FakeElement;
    if (node.parentElement) {
      node.parentElement.removeChild(node);
    }
    node.parentElement = this;
    node.parentNode = this;
    if (!this.children.includes(node)) {
      this.children.push(node);
    }
    return child;
  }

  insertBefore(child: unknown, before: unknown) {
    const node = child as FakeElement;
    if (node.parentElement) {
      node.parentElement.removeChild(node);
    }
    const sibling = before as FakeElement | null;
    const index = sibling ? this.children.indexOf(sibling) : -1;
    node.parentElement = this;
    if (index >= 0) {
      this.children.splice(index, 0, node);
    } else {
      this.children.push(node);
    }
    node.parentNode = this;
    return child;
  }

  removeChild(child: FakeElement) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
      child.parentNode = null;
    }
    return child;
  }

  replaceChildren(...nodes: unknown[]) {
    for (const child of [...this.children]) {
      child.parentElement = null;
      child.parentNode = null;
    }
    this.children = [];
    nodes.forEach((node) => this.appendChild(node));
  }

  contains(node: unknown) {
    return this.children.includes(node as FakeElement);
  }

  remove() {
    this.parentElement?.removeChild(this);
    if (this.id) {
      this.ownerDocument?.unregister(this.id, this);
    }
  }

  addEventListener(type: string, listener: (...args: any[]) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string) {
    this.listeners.get(type)?.forEach((listener) => listener({ type }));
  }

  focus() {}

  querySelector(selector: string): FakeElement | null {
    if (!selector.startsWith("#")) {
      return null;
    }
    return this.ownerDocument.getElementById(
      selector.slice(1),
    ) as FakeElement | null;
  }

  closest(selector: string): FakeElement | null {
    if (selector === '[data-pane-id="ai-assistant-sidebar"]') {
      let current: FakeElement | null = this;
      while (current) {
        if (current.dataset.paneId === "ai-assistant-sidebar") {
          return current;
        }
        current = current.parentElement;
      }
    }
    return null;
  }
}

class FakeDocument {
  defaultView: (Window & typeof globalThis) | null = null;
  private nodes = new Map<string, FakeElement>();
  documentElement: FakeElement;
  body: FakeElement;

  constructor() {
    this.documentElement = this.createElement("documentElement");
    this.body = this.createElement("body");
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName: string) {
    const element = new FakeElement(tagName);
    element.ownerDocument = this;
    return element;
  }

  createElementNS(_ns: string, tagName: string) {
    return this.createElement(tagName);
  }

  createXULElement(tagName: string) {
    return this.createElement(tagName);
  }

  getElementById(id: string) {
    return this.nodes.get(id) ?? null;
  }

  querySelector(selector: string) {
    if (!selector.startsWith("#")) {
      return null;
    }
    return this.getElementById(selector.slice(1));
  }

  register(element: FakeElement) {
    if (element.id) {
      this.nodes.set(element.id, element);
    }
  }

  unregister(id: string, element: FakeElement) {
    if (this.nodes.get(id) === element) {
      this.nodes.delete(id);
    }
  }
}

class FakeWindow {
  closed = false;
  document = new FakeDocument();
  MozXULElement = {
    insertFTLIfNeeded: vi.fn(),
  };
  ZoteroPane = {
    getSelectedItems: () => [{}],
    itemPane: {
      collapsed: false,
    },
  };
  ZoteroContextPane = {
    collapsed: false,
    togglePane: vi.fn(() => {
      this.ZoteroContextPane.collapsed = !this.ZoteroContextPane.collapsed;
    }),
  };
  Zotero_Tabs = {
    selectedType: "library",
  };
  setTimeout = ((fn: (...args: any[]) => void) => {
    fn();
    return 0;
  }) as Window["setTimeout"];
  clearTimeout = (() => {}) as Window["clearTimeout"];

  constructor() {
    this.document.defaultView = this as unknown as Window & typeof globalThis;
  }
}

function attachRoot(doc: FakeDocument, parent: FakeElement, id: string) {
  const element = doc.createElement("div");
  element.setAttribute("id", id);
  parent.appendChild(element);
  return element;
}

function attachMessagePane(doc: FakeDocument, parent: FakeElement) {
  const pane = attachRoot(doc, parent, "zotero-item-message");
  const customHead = doc.createElement("div");
  customHead.className = "custom-head";
  pane.appendChild(customHead);

  (pane as any).render = vi.fn((node: unknown) => {
    const messageBox =
      (pane as any).__messageBox ??
      (() => {
        const next = doc.createElement("div");
        pane.appendChild(next);
        (pane as any).__messageBox = next;
        return next;
      })();
    messageBox.replaceChildren(node);
  });

  (pane as any).renderCustomHead = vi.fn(
    (
      callback?: (args: {
        doc: FakeDocument;
        append: (...nodes: unknown[]) => void;
      }) => void,
    ) => {
      customHead.replaceChildren();
      callback?.({
        doc,
        append: (...nodes: unknown[]) => {
          nodes.forEach((node) => customHead.appendChild(node));
        },
      });
    },
  );

  return {
    customHead,
    pane,
  };
}

describe("UIFactory", () => {
  let registerSectionMock: ReturnType<typeof vi.fn>;
  let unregisterSectionMock: ReturnType<typeof vi.fn>;
  let mainWindows: FakeWindow[];

  beforeEach(async () => {
    mocks.createRoot.mockReset();
    mocks.sidebarVisible.mockReset();
    mocks.sidebarVisible.mockReturnValue(true);
    mocks.registerSidebarRefreshHandler.mockReset();
    mocks.registerSidebarRefreshHandler.mockImplementation(() => vi.fn());
    mocks.setSidebarVisible.mockReset();
    mocks.eventBusDispatchEvent.mockReset();
    mocks.eventBusGetInstance.mockClear();
    mocks.getPref.mockReset();
    mocks.getPref.mockReturnValue("I");
    mocks.getCurrentScope.mockReset();
    mocks.getCurrentScope.mockReturnValue({
      id: "paper-17",
      itemIds: [17],
      label: "Scope Probe",
      type: "paper",
    });
    mocks.registerObserver.mockReset();
    mocks.registerObserver.mockReturnValue("tab-observer-id");
    mocks.unregisterObserver.mockReset();

    registerSectionMock = vi.fn();
    unregisterSectionMock = vi.fn();
    mainWindows = [];

    mocks.createRoot.mockImplementation(() => ({
      render: vi.fn(),
      unmount: vi.fn(),
    }));

    await import("react-dom/client");

    (globalThis as any).addon = {
      data: {
        config: {
          addonID: "zotero-ai-assistant@agentpaper.dev",
          addonRef: "zotero-ai-assistant",
        },
      },
    };

    (globalThis as any).Zotero = {
      File: {
        putContents: vi.fn(),
      },
      ItemPaneManager: {
        registerSection: registerSectionMock,
        unregisterSection: unregisterSectionMock,
      },
      Notifier: {
        registerObserver: mocks.registerObserver,
        unregisterObserver: mocks.unregisterObserver,
      },
      getMainWindows: () => mainWindows,
      isMac: false,
    };
    (globalThis as any).ztoolkit = {
      log: vi.fn(),
    };
  });

  afterEach(() => {
    UIFactory.shutdown();
  });

  it("creates one native host per surface and reuses it across refreshes", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const libraryBody = win.document.createElement("vbox");
    libraryBody.ownerDocument = win.document;
    sectionConfig.onRender({
      body: libraryBody,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(sectionConfig).toBeTruthy();
    expect(
      win.document.getElementById("zotero-ai-assistant-tb-chat-toggle"),
    ).toBeNull();
  });

  it("requests a native section refresh when the window refreshes so cold start can recover the library pane", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const refresh = vi.fn().mockResolvedValue(undefined);
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      refresh,
      setEnabled,
      tabType: "library",
    });

    refresh.mockClear();
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();

    expect(refresh).toHaveBeenCalled();
  });

  it("does not render a standalone library empty-state panel when no item is selected", async () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [];
    const sidenav = attachRoot(
      win.document,
      win.document.body,
      "zotero-view-item-sidenav",
    );
    const buttonContainer = win.document.createElement("div");
    buttonContainer.className = "inherit-flex";
    sidenav.appendChild(buttonContainer);
    const { customHead, pane: messagePane } = attachMessagePane(
      win.document,
      win.document.body,
    );

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(
      win.document.getElementById(
        "ai-assistant-library-empty-state-sidenav-btn",
      ),
    ).toBeNull();
    expect(messagePane.children).toContain(customHead);
    expect(customHead.children).toHaveLength(1);
    expect((customHead.children[0] as FakeElement).id).toBe(
      "ai-assistant-pane-library-mount",
    );
  });

  it("removes legacy standalone library artifacts without touching native empty messages", async () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [];

    const messagePane = attachRoot(
      win.document,
      win.document.body,
      "zotero-item-message",
    );
    const nativeMessage = attachRoot(
      win.document,
      messagePane,
      "zotero-native-empty-message",
    );
    attachRoot(win.document, messagePane, "ai-assistant-library-empty-state");

    const sidenav = attachRoot(
      win.document,
      win.document.body,
      "zotero-view-item-sidenav",
    );
    attachRoot(
      win.document,
      sidenav,
      "ai-assistant-library-empty-state-sidenav-btn",
    );

    const toolbar = attachRoot(
      win.document,
      win.document.body,
      "zotero-items-toolbar",
    );
    attachRoot(win.document, toolbar, "zotero-ai-assistant-tb-chat-toggle");

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(
      win.document.getElementById(
        "ai-assistant-library-empty-state-sidenav-btn",
      ),
    ).toBeNull();
    expect(
      win.document.getElementById("zotero-ai-assistant-tb-chat-toggle"),
    ).toBeNull();
    expect(messagePane.children).toEqual([nativeMessage]);
  });

  it("does not write release-only host diagnostics during refresh", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "reader";
    (win.Zotero_Tabs as any).selectedID = "reader-tab-7";

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const putContents = (globalThis as any).Zotero.File
      .putContents as ReturnType<typeof vi.fn>;
    expect(putContents).toHaveBeenCalledTimes(0);
  });

  it("does not mutate native pane collapsed state in section-body mode", async () => {
    const win = new FakeWindow();
    win.ZoteroPane.itemPane.collapsed = true;
    win.ZoteroContextPane.collapsed = true;
    win.Zotero_Tabs.selectedType = "library";

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();
    expect(win.ZoteroPane.itemPane.collapsed).toBe(true);
    expect(win.ZoteroContextPane.togglePane).toHaveBeenCalledTimes(0);

    win.Zotero_Tabs.selectedType = "reader";
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    expect(win.ZoteroContextPane.togglePane).toHaveBeenCalledTimes(0);

    UIFactory.removeChatPanel(win as unknown as Window & typeof globalThis);

    expect(win.ZoteroPane.itemPane.collapsed).toBe(true);
    expect(win.ZoteroContextPane.togglePane).toHaveBeenCalledTimes(0);
  });

  it("does not force native section open or scroll while rendering section bodies", async () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const sectionContainer = win.document.createElement("section");
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    sectionContainer.appendChild(body);
    (sectionContainer as any).scrollIntoView = vi.fn();
    (body as any).scrollIntoView = vi.fn();
    (body as any).scrollTo = vi.fn();

    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(sectionContainer.getAttribute("open")).toBeNull();
    expect((sectionContainer as any).scrollIntoView).toHaveBeenCalledTimes(0);
    expect((body as any).scrollIntoView).toHaveBeenCalledTimes(0);
    expect((body as any).scrollTo).toHaveBeenCalledTimes(0);
  });

  it("uses the section only as a fallback when the native pane is unavailable", () => {
    const win = new FakeWindow();

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    expect(sectionConfig).toBeTruthy();

    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    body.ownerDocument.defaultView = null;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "library",
    });
    expect(setEnabled).toHaveBeenCalledWith(true);

    sectionConfig.onRender({
      body,
      tabType: "library",
    });

    expect(body.children).toHaveLength(1);
    const fallbackMount = body.children[0];
    expect(fallbackMount.id).toBe("ai-assistant-pane-library-mount");
  });

  it("does not render fallback content when a native pane exists", () => {
    const win = new FakeWindow();
    const libraryPane = attachRoot(
      win.document,
      win.document.body,
      "zotero-item-pane",
    );
    attachRoot(win.document, libraryPane, "native-library-content");
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "library",
    });
    expect(setEnabled).toHaveBeenCalledWith(true);

    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    expect(body.children).toHaveLength(0);
  });

  it("leaves the Zotero empty-message pane untouched while no library item is selected", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.ZoteroPane.getSelectedItems = () => [];
    const { customHead, pane: messagePane } = attachMessagePane(
      win.document,
      win.document.body,
    );
    const nativeMessage = attachRoot(
      win.document,
      messagePane,
      "zotero-native-empty-message",
    );

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(messagePane.children).toContain(nativeMessage);
    expect(customHead.children).toHaveLength(1);

    win.ZoteroPane.getSelectedItems = () => [{}];
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(customHead.children).toHaveLength(0);
    expect(messagePane.children).toContain(nativeMessage);
  });

  it("does not create standalone library artifacts during teardown", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.ZoteroPane.getSelectedItems = () => [];
    const { customHead } = attachMessagePane(win.document, win.document.body);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();
    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(customHead.children).toHaveLength(1);

    UIFactory.removeChatPanel(win as unknown as Window & typeof globalThis);

    expect(
      win.document.getElementById("ai-assistant-library-empty-state"),
    ).toBeNull();
    expect(customHead.children).toHaveLength(0);
  });

  it("retries library empty-state mounting when the Zotero message pane appears after startup", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [];

    const queuedTimeouts: Array<() => void> = [];
    win.setTimeout = ((fn: (...args: any[]) => void) => {
      queuedTimeouts.push(() => fn());
      return queuedTimeouts.length - 1;
    }) as unknown as Window["setTimeout"];
    win.clearTimeout = ((id: number) => {
      queuedTimeouts[id] = () => {};
    }) as unknown as Window["clearTimeout"];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const { customHead } = attachMessagePane(win.document, win.document.body);
    queuedTimeouts.forEach((callback) => callback());
    await Promise.resolve();
    await Promise.resolve();

    expect(customHead.children).toHaveLength(1);
    expect((customHead.children[0] as FakeElement).id).toBe(
      "ai-assistant-pane-library-mount",
    );
  });

  it("keeps retrying library empty-state mounting across multiple cold-start ticks before the message pane is ready", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [];

    const queuedTimeouts: Array<() => void> = [];
    win.setTimeout = ((fn: (...args: any[]) => void) => {
      queuedTimeouts.push(() => fn());
      return queuedTimeouts.length - 1;
    }) as unknown as Window["setTimeout"];
    win.clearTimeout = ((id: number) => {
      queuedTimeouts[id] = () => {};
    }) as unknown as Window["clearTimeout"];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    expect(queuedTimeouts).toHaveLength(1);

    queuedTimeouts[0]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(queuedTimeouts).toHaveLength(2);

    const { customHead } = attachMessagePane(win.document, win.document.body);
    queuedTimeouts[1]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(customHead.children).toHaveLength(1);
    expect((customHead.children[0] as FakeElement).id).toBe(
      "ai-assistant-pane-library-mount",
    );
  });

  it("reuses a single section-body React root across repeated renders", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;

    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createRoot).toHaveBeenCalledTimes(1);
  });

  it("removes mounted UI artifacts from main windows during shutdown", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.ZoteroPane.getSelectedItems = () => [{}];
    const reactRoot = {
      render: vi.fn(),
      unmount: vi.fn(),
    };
    mocks.createRoot.mockReturnValueOnce(reactRoot);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createRoot).toHaveBeenCalledWith(body);

    UIFactory.shutdown();

    expect(reactRoot.unmount).toHaveBeenCalledTimes(1);
  });

  it("registers the right-side item pane section as the primary visible entry point", () => {
    const win = new FakeWindow();
    const libraryPane = attachRoot(
      win.document,
      win.document.body,
      "zotero-item-pane",
    );
    attachRoot(win.document, libraryPane, "native-library-content");
    const readerOuter = attachRoot(
      win.document,
      win.document.body,
      "zotero-context-pane",
    );
    const readerInner = attachRoot(
      win.document,
      readerOuter,
      "zotero-context-pane-inner",
    );
    attachRoot(win.document, readerInner, "native-reader-content");
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    expect(sectionConfig).toBeTruthy();
    expect(sectionConfig.header).toEqual({
      l10nID: "ai-assistant-sidebar-title",
      icon: "chrome://zotero-ai-assistant/content/icons/icon-20.png",
    });
    expect(sectionConfig.sidenav).toEqual({
      l10nID: "ai-assistant-sidebar-sidenav",
      icon: "chrome://zotero-ai-assistant/content/icons/icon-20.png",
    });

    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "library",
    });
    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("enables the section when Zotero reports a library selection through selectedType even if tabType is opaque", () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "zotero-pane",
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("keeps the native section enabled for collection scope when no library item is selected", () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "item-tree";
    win.ZoteroPane.getSelectedItems = () => [];
    mocks.getCurrentScope.mockReturnValue({
      id: "collection-1-ABC",
      itemIds: [1, 2, 3],
      label: "My Collection",
      type: "collection",
    });

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "item-tree",
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
  });

  it("renders the library host when tabType is opaque but the selected Zotero tab is library", async () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [{}];
    mainWindows.push(win);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;

    sectionConfig.onRender({
      body,
      tabType: "zotero-pane",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createRoot).toHaveBeenCalledWith(body);
  });

  it("refreshes host visibility when a Zotero tab selection event fires", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const refresh = vi.fn().mockResolvedValue(undefined);
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      refresh,
      setEnabled,
      tabType: "zotero-pane",
    });

    const registerObserverMock = mocks.registerObserver as unknown as {
      mock: {
        calls: Array<
          [
            {
              notify: (event: string, type: string) => void;
            },
            string[],
            string,
          ]
        >;
      };
    };
    const observerCallback = registerObserverMock.mock.calls[0]?.[0];
    expect(observerCallback).toBeTruthy();

    win.Zotero_Tabs.selectedType = "reader-preview";
    observerCallback?.notify("select", "tab");
    await Promise.resolve();
    await Promise.resolve();

    expect(refresh).toHaveBeenCalled();

    UIFactory.removeChatPanel(win as unknown as Window & typeof globalThis);
    expect(mocks.unregisterObserver).toHaveBeenCalledWith("tab-observer-id");
  });

  it("pushes the latest library scope to the mounted sidebar when the native item pane selection changes", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    mocks.eventBusDispatchEvent.mockClear();
    mocks.getCurrentScope.mockReturnValue({
      id: "paper-202",
      itemIds: [202],
      label: "Fresh Library Paper",
      type: "paper",
    });

    sectionConfig.onItemChange({
      body,
      setEnabled,
      tabType: "library",
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(mocks.eventBusDispatchEvent).toHaveBeenCalledTimes(1);
    const dispatchedEvent = mocks.eventBusDispatchEvent.mock
      .calls[0]?.[0] as CustomEvent;
    expect(dispatchedEvent.type).toBe("scopeChange");
    expect(dispatchedEvent.detail).toEqual({
      id: "paper-202",
      itemIds: [202],
      label: "Fresh Library Paper",
      type: "paper",
    });
  });

  it("uses the Zotero host window CustomEvent when the plugin global lacks it", async () => {
    const originalCustomEvent = (globalThis as any).CustomEvent;
    (globalThis as any).CustomEvent = undefined;

    try {
      const win = new FakeWindow();
      (win as any).CustomEvent = class HostCustomEvent extends Event {
        detail: unknown;

        constructor(type: string, init?: CustomEventInit) {
          super(type);
          this.detail = init?.detail;
        }
      };
      mainWindows.push(win);
      win.Zotero_Tabs.selectedType = "library";
      win.ZoteroPane.getSelectedItems = () => [{}];

      UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
      const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
      const body = win.document.createElement("vbox");
      body.ownerDocument = win.document;

      mocks.eventBusDispatchEvent.mockClear();
      mocks.getCurrentScope.mockReturnValue({
        id: "paper-host-event",
        itemIds: [303],
        label: "Host Event Paper",
        type: "paper",
      });

      sectionConfig.onItemChange({
        body,
        setEnabled: vi.fn(),
        tabType: "library",
      });

      const dispatchedEvent = mocks.eventBusDispatchEvent.mock
        .calls[0]?.[0] as CustomEvent;
      expect(dispatchedEvent.type).toBe("scopeChange");
      expect(dispatchedEvent.detail).toEqual({
        id: "paper-host-event",
        itemIds: [303],
        label: "Host Event Paper",
        type: "paper",
      });
    } finally {
      (globalThis as any).CustomEvent = originalCustomEvent;
    }
  });

  it("retries library scope sync when the first item-pane pass still sees the previous paper", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [{}];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    mocks.eventBusDispatchEvent.mockClear();
    mocks.getCurrentScope
      .mockReturnValueOnce({
        id: "paper-101",
        itemIds: [101],
        label: "Old Library Paper",
        type: "paper",
      })
      .mockReturnValueOnce({
        id: "paper-202",
        itemIds: [202],
        label: "Fresh Library Paper",
        type: "paper",
      });

    sectionConfig.onItemChange({
      body,
      setEnabled,
      tabType: "library",
    });

    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(mocks.eventBusDispatchEvent).toHaveBeenCalledTimes(2);
    const dispatchedEvents = mocks.eventBusDispatchEvent.mock.calls.map(
      (call) => call[0] as CustomEvent,
    );
    expect(dispatchedEvents[0]?.detail).toEqual({
      id: "paper-101",
      itemIds: [101],
      label: "Old Library Paper",
      type: "paper",
    });
    expect(dispatchedEvents[1]?.detail).toEqual({
      id: "paper-202",
      itemIds: [202],
      label: "Fresh Library Paper",
      type: "paper",
    });
  });

  it("keeps the library section enabled after cold start when the library tab becomes concrete on the next item change", () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "library";
    win.ZoteroPane.getSelectedItems = () => [];

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const body = win.document.createElement("vbox");
    body.ownerDocument = win.document;
    const setEnabled = vi.fn();

    sectionConfig.onInit({
      body,
      setEnabled,
      tabType: "library",
    });
    expect(setEnabled).toHaveBeenLastCalledWith(true);

    win.ZoteroPane.getSelectedItems = () => [{}];
    sectionConfig.onItemChange({
      body,
      setEnabled,
      tabType: "library",
    });

    expect(setEnabled).toHaveBeenLastCalledWith(true);
  });

  it("restores the expanded Reader section when switching between PDF tabs after the user opened Deepseek Copliot", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "reader";

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const firstSection = win.document.createElement("section");
    firstSection.dataset.paneId = "ai-assistant-sidebar";
    firstSection.removeAttribute("collapsed");
    const firstBody = win.document.createElement("vbox");
    firstBody.ownerDocument = win.document;
    firstSection.appendChild(firstBody);

    sectionConfig.onRender({
      body: firstBody,
      tabType: "reader",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const secondSection = win.document.createElement("section");
    secondSection.dataset.paneId = "ai-assistant-sidebar";
    secondSection.setAttribute("collapsed", "true");
    const secondBody = win.document.createElement("vbox");
    secondBody.ownerDocument = win.document;
    secondSection.appendChild(secondBody);

    sectionConfig.onItemChange({
      body: secondBody,
      setEnabled: vi.fn(),
      tabType: "reader",
    });

    expect(secondSection.getAttribute("collapsed")).toBeNull();
    expect(secondSection.getAttribute("open")).toBe("true");
  });

  it("remounts the Reader section body on item change when Zotero does not call render again", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "reader";

    const reactRoot = {
      render: vi.fn(),
      unmount: vi.fn(),
    };
    mocks.createRoot.mockReturnValue(reactRoot);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);

    const sectionConfig = registerSectionMock.mock.calls[0]?.[0];
    const firstSection = win.document.createElement("section");
    firstSection.dataset.paneId = "ai-assistant-sidebar";
    const firstBody = win.document.createElement("vbox");
    firstBody.ownerDocument = win.document;
    firstSection.appendChild(firstBody);

    sectionConfig.onRender({
      body: firstBody,
      tabType: "reader",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const secondSection = win.document.createElement("section");
    secondSection.dataset.paneId = "ai-assistant-sidebar";
    const secondBody = win.document.createElement("vbox");
    secondBody.ownerDocument = win.document;
    secondSection.appendChild(secondBody);

    sectionConfig.onItemChange({
      body: secondBody,
      setEnabled: vi.fn(),
      tabType: "reader",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.createRoot).toHaveBeenCalledWith(firstBody);
    expect(mocks.createRoot).toHaveBeenCalledWith(secondBody);
    expect(reactRoot.unmount).toHaveBeenCalledTimes(1);
    expect(reactRoot.render).toHaveBeenCalledTimes(2);
  });
});
