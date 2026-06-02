import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sidebarVisible: vi.fn(() => true),
  registerSidebarRefreshHandler: vi.fn(() => vi.fn()),
  setSidebarVisible: vi.fn(),
  eventBusGetInstance: vi.fn(() => ({ addEventListener() {}, removeEventListener() {} })),
  getPref: vi.fn(() => "I"),
  registerObserver: vi.fn(() => "tab-observer-id"),
  unregisterObserver: vi.fn(),
  createRoot: vi.fn(),
  reactDomImport: vi.fn(),
}));

vi.mock(import("react-dom/client"), async () => {
  const actual = await vi.importActual<typeof import("react-dom/client")>("react-dom/client");
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
  getCurrentScope: vi.fn(() => ({
    id: "paper-17",
    itemIds: [17],
    label: "Scope Probe",
    type: "paper",
  })),
}));

import { UIFactory } from "./ui";

class FakeElement {
  private _id = "";
  className = "";
  textContent = "";
  parentElement: FakeElement | null = null;
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
    return child;
  }

  removeChild(child: FakeElement) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      child.parentElement = null;
    }
    return child;
  }

  replaceChildren(...nodes: unknown[]) {
    for (const child of [...this.children]) {
      child.parentElement = null;
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
    return this.ownerDocument.getElementById(selector.slice(1)) as FakeElement | null;
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
    mocks.eventBusGetInstance.mockClear();
    mocks.getPref.mockReset();
    mocks.getPref.mockReturnValue("I");
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

  it("keeps rendering into the section body even when the legacy sidebar visibility flag is false", async () => {
    const win = new FakeWindow();
    win.Zotero_Tabs.selectedType = "library";

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

    mocks.sidebarVisible.mockReturnValue(false);
    sectionConfig.onRender({
      body,
      tabType: "library",
    });
    await Promise.resolve();

    expect(mocks.createRoot).toHaveBeenCalledWith(body);
  });

  it("writes host diagnostics including selected tab state and model evidence for smoke collection", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);
    win.Zotero_Tabs.selectedType = "reader";
    (win.Zotero_Tabs as any).selectedID = "reader-tab-7";

    (globalThis as any).__aiAssistantDiagnostics = {
      lastProviderRequest: {
        endpoint: "https://api.deepseek.com/chat/completions",
        messageCount: 3,
        model: "deepseek-v4-pro",
        stream: true,
      },
    };

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    UIFactory.refreshWindow(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const putContents = (globalThis as any).Zotero.File.putContents as ReturnType<typeof vi.fn>;
    const latestCall = putContents.mock.calls.at(-1) ?? [];
    const latestPayload = [...latestCall]
      .reverse()
      .find((value) => typeof value === "string");
    expect(typeof latestPayload).toBe("string");

    const parsed = JSON.parse(String(latestPayload));
    expect(parsed.selectedType).toBe("reader");
    expect(parsed.selectedID).toBe("reader-tab-7");
    expect(parsed.currentScope).toEqual({
      id: "paper-17",
      itemIds: [17],
      label: "Scope Probe",
      readerAttachmentId: null,
      type: "paper",
    });
    expect(parsed.modelState).toEqual({
      lastProviderRequestEndpoint: "https://api.deepseek.com/chat/completions",
      lastProviderRequestModel: "deepseek-v4-pro",
      lastProviderRequestMessageCount: 3,
    });
    expect(parsed.nodes.libraryMount).toBeNull();
    expect(parsed.nodes.readerMount).toBeNull();
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
    const libraryPane = attachRoot(win.document, win.document.body, "zotero-item-pane");
    attachRoot(win.document, libraryPane, "native-library-content");

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

  it("reuses a single section-body React root across repeated renders", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);

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

    expect(win.document.getElementById("zotero-ai-assistant-tb-chat-toggle")).toBeNull();
  });

  it("registers the right-side item pane section as the primary visible entry point", () => {
    const win = new FakeWindow();
    const libraryPane = attachRoot(win.document, win.document.body, "zotero-item-pane");
    attachRoot(win.document, libraryPane, "native-library-content");
    const readerOuter = attachRoot(win.document, win.document.body, "zotero-context-pane");
    const readerInner = attachRoot(win.document, readerOuter, "zotero-context-pane-inner");
    attachRoot(win.document, readerInner, "native-reader-content");

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

  it("refreshes host visibility when a Zotero tab selection event fires", async () => {
    const win = new FakeWindow();
    mainWindows.push(win);

    UIFactory.registerChatPanel(win as unknown as Window & typeof globalThis);
    await Promise.resolve();
    await Promise.resolve();

    const registerObserverMock = mocks.registerObserver as unknown as {
      mock: { calls: Array<[{
        notify: (event: string, type: string) => void;
      }, string[], string]> };
    };
    const observerCallback = registerObserverMock.mock.calls[0]?.[0];
    expect(observerCallback).toBeTruthy();

    win.Zotero_Tabs.selectedType = "reader-preview";
    observerCallback?.notify("select", "tab");
    await Promise.resolve();
    await Promise.resolve();

    UIFactory.removeChatPanel(win as unknown as Window & typeof globalThis);
    expect(mocks.unregisterObserver).toHaveBeenCalledWith("tab-observer-id");
  });
});
