import { describe, expect, it } from "vitest";

import {
  attachSidebarHost,
  attachSidebarHostToNativePane,
  createFallbackSidebarHost,
  ensureSidebarHostState,
  getLibraryNativePane,
  getReaderNativePane,
  isSidebarLocationSelected,
  listPaneSiblings,
  resolveSidebarLocation,
  resolveReaderFallbackContainer,
  setElementsVisible,
  syncSidebarHost,
  type SidebarHostMount,
  type SidebarHostState,
} from "./sidebarSection";

class FakeBody {
  children: unknown[] = [];

  constructor(initialChildren: unknown[] = []) {
    this.children = [...initialChildren];
  }

  contains(node: unknown) {
    return this.children.includes(node);
  }

  replaceChildren(...nodes: unknown[]) {
    this.children = [...nodes];
  }
}

class FakeElement {
  id = "";
  className = "";
  dataset = {} as Record<string, string>;
  textContent = "";
  style = {
    removeProperty: (name: string) => {
      delete (this.style as Record<string, string | ((name: string) => void)>)[name];
    },
  } as Record<string, string | ((name: string) => void)>;
  children: unknown[] = [];

  setAttribute(name: string, value: string) {
    if (name === "id") this.id = value;
    if (name === "class") this.className = value;
    this.dataset[name] = value;
  }

  appendChild(child: unknown) {
    this.children.push(child);
    return child;
  }

  remove() {
    this.children = [];
  }
}

class FakeDocument {
  constructor(
    private readonly nodes: Record<string, unknown> = {},
  ) {}

  getElementById(id: string) {
    return (this.nodes[id] as Element | null) || null;
  }
}

class FakeWindow {
  document = {
    createElement: (_tagName: string) => new FakeElement(),
    createElementNS: (_ns: string, _tagName: string) => new FakeElement(),
    createXULElement: (_tagName: string) => new FakeElement(),
  };
}

class FakePane extends FakeElement {
  override appendChild(child: unknown) {
    this.children.push(child);
    return child;
  }
}

describe("sidebarSection helpers", () => {
  it("enables the sidebar only for library and reader tabs", () => {
    expect(resolveSidebarLocation("library")).toBe("library");
    expect(resolveSidebarLocation("reader")).toBe("reader");
    expect(resolveSidebarLocation("library-tab")).toBe("library");
    expect(resolveSidebarLocation("collection")).toBe("library");
    expect(resolveSidebarLocation("item-tree")).toBe("library");
    expect(resolveSidebarLocation("reader-view")).toBe("reader");
    expect(resolveSidebarLocation("note")).toBeNull();
    expect(resolveSidebarLocation("unknown")).toBeNull();
  });

  it("matches reader-like tab types to the reader sidebar location", () => {
    expect(isSidebarLocationSelected("reader", "reader")).toBe(true);
    expect(isSidebarLocationSelected("reader-preview", "reader")).toBe(true);
    expect(isSidebarLocationSelected("reader-loading", "reader")).toBe(true);
    expect(isSidebarLocationSelected("library", "reader")).toBe(false);
    expect(isSidebarLocationSelected("collection", "library")).toBe(true);
  });

  it("reparents a persistent host into the active section body only once", () => {
    const staleNode = { id: "stale" };
    const host = { id: "host" };
    const body = new FakeBody([staleNode]);

    expect(attachSidebarHost(body, host)).toBe(true);
    expect(body.children).toEqual([host]);

    expect(attachSidebarHost(body, host)).toBe(false);
    expect(body.children).toEqual([host]);
  });

  it("creates exactly one persistent host per surface and reuses it across body switches", () => {
    const win = new FakeWindow() as unknown as Window;
    const state: SidebarHostState = {};

    const libraryBodyA = new FakeBody();
    const libraryBodyB = new FakeBody();

    const first = syncSidebarHost(win, state, "library", libraryBodyA);
    const second = syncSidebarHost(win, state, "library", libraryBodyB);

    expect(first.hostState).toBe(second.hostState);
    expect(first.didAttach).toBe(true);
    expect(second.didAttach).toBe(true);
    expect(first.hostState.attachmentTarget).toBe("section-fallback");
    expect(libraryBodyA.children).toEqual([first.hostState.mountPoint]);
    expect(libraryBodyB.children).toEqual([first.hostState.mountPoint]);
  });

  it("keeps library and reader hosts isolated per surface", () => {
    const win = new FakeWindow() as unknown as Window;
    const state: SidebarHostState = {};

    const library = syncSidebarHost(win, state, "library", new FakeBody());
    const reader = syncSidebarHost(win, state, "reader", new FakeBody());

    expect(library.hostState).not.toBe(reader.hostState);
    expect(state.library).toBe(library.hostState);
    expect(state.reader).toBe(reader.hostState);
  });

  it("provides a stable fallback host when high-level window state is unavailable", () => {
    const body = new FakeBody();
    const fallbackA = createFallbackSidebarHost(
      "reader",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    const fallbackB = ensureSidebarHostState(undefined, "reader", fallbackA);
    const fallbackC = ensureSidebarHostState(undefined, "reader", fallbackA);

    expect(fallbackB).toBe(fallbackA);
    expect(fallbackC).toBe(fallbackA);
    expect(attachSidebarHost(body, fallbackA)).toBe(true);
    expect(body.children).toEqual([fallbackA.mountPoint]);
  });

  it("attaches a shared host to the native library pane", () => {
    const host = createFallbackSidebarHost(
      "library",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    const pane = new FakePane();

    expect(attachSidebarHostToNativePane(pane, host, "library")).toBe(true);
    expect(pane.children).toEqual([host.mountPoint]);
    expect(host.attachmentTarget).toBe("native-library");
  });

  it("attaches a shared host to the native reader pane", () => {
    const host = createFallbackSidebarHost(
      "reader",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    const pane = new FakePane();

    expect(attachSidebarHostToNativePane(pane, host, "reader")).toBe(true);
    expect(pane.children).toEqual([host.mountPoint]);
    expect(host.attachmentTarget).toBe("native-reader");
  });

  it("reuses the same reader host when moving from native pane back to the section fallback", () => {
    const win = new FakeWindow() as unknown as Window;
    const state: SidebarHostState = {};
    const nativePane = new FakePane();
    const officialBody = new FakeBody();

    const host = createFallbackSidebarHost(
      "reader",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    state.reader = host;

    attachSidebarHostToNativePane(nativePane, host, "reader");
    const attached = syncSidebarHost(win, state, "reader", officialBody);

    expect(attached.hostState).toBe(host);
    expect(attached.hostState.attachmentTarget).toBe("section-fallback");
    expect(officialBody.children).toEqual([host.mountPoint]);
  });

  it("prefers the reader inner container when resolving a direct reader fallback target", () => {
    const outer = new FakeElement();
    const inner = new FakeElement();
    const doc = new FakeDocument({
      "zotero-context-pane": outer,
      "zotero-context-pane-inner": inner,
    }) as unknown as Pick<Document, "getElementById">;

    expect(resolveReaderFallbackContainer(doc)).toBe(inner as unknown as HTMLElement);
  });

  it("resolves native library and reader panes from Zotero host ids", () => {
    const library = new FakeElement();
    const outer = new FakeElement();
    const inner = new FakeElement();
    const doc = new FakeDocument({
      "zotero-item-pane": library,
      "zotero-context-pane": outer,
      "zotero-context-pane-inner": inner,
    }) as unknown as Pick<Document, "getElementById">;

    expect(getLibraryNativePane(doc)).toBe(library as unknown as HTMLElement);
    expect(getReaderNativePane(doc)).toBe(inner as unknown as HTMLElement);
  });

  it("lists non-host siblings and toggles their visibility", () => {
    const first = new FakeElement() as unknown as HTMLElement;
    const host = new FakeElement();
    host.id = "ai-assistant-pane-library-mount";
    const second = new FakeElement() as unknown as HTMLElement;
    const pane = {
      children: [first, host as unknown as HTMLElement, second],
    } as unknown as ParentNode;

    const siblings = listPaneSiblings(pane, host.id);
    expect(siblings).toEqual([first, second]);

    setElementsVisible(siblings, false);
    expect((first as any).style.display).toBe("none");
    expect((second as any).style.display).toBe("none");

    setElementsVisible(siblings, true);
    expect((first as any).style.display).toBeUndefined();
    expect((second as any).style.display).toBeUndefined();
  });

  it("creates fallback hosts from the provided document factory using a XUL mount and an inner react root", () => {
    const mountPoint = new FakeElement();
    const reactRootElement = new FakeElement();
    const doc = {
      createElement: () => reactRootElement,
      createElementNS: () => reactRootElement,
      createXULElement: () => mountPoint,
    } as unknown as Pick<Document, "createElement" | "createElementNS"> & {
      createXULElement: (tagName: string) => FakeElement;
    };

    const createdHost = createFallbackSidebarHost("library", doc);

    expect(createdHost.mountPoint).toBe(mountPoint as unknown as SidebarHostMount);
    expect(createdHost.reactRootElement).toBe(reactRootElement as unknown as HTMLDivElement);
    expect(createdHost.mountPoint.id).toBe("ai-assistant-pane-library-mount");
    expect(createdHost.reactRootElement.id).toBe("ai-assistant-pane-library");
    expect(createdHost.mountPoint.children).toEqual([createdHost.reactRootElement]);
    expect((createdHost.mountPoint as any).style.minWidth).toBe("0");
    expect((createdHost.reactRootElement as any).style.minWidth).toBe("0");
    expect(createdHost.bootstrapped).toBe(false);
  });
});
