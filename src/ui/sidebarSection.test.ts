import { describe, expect, it } from "vitest";

import {
  attachSidebarHost,
  attachSidebarHostToLibraryFallback,
  attachSidebarHostToReaderFallback,
  createFallbackSidebarHost,
  ensureSidebarHostState,
  resolveSidebarLocation,
  resolveReaderFallbackContainer,
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
  style = {} as Record<string, string>;
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

class FakeLibraryMessagePane extends FakeBody {
  rendered: unknown[] = [];
  renderCustomHeadCalls = 0;

  ownerDocument = {} as Document;

  render(node: unknown) {
    this.rendered.push(node);
    this.replaceChildren(node);
  }

  renderCustomHead() {
    this.renderCustomHeadCalls += 1;
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

describe("sidebarSection helpers", () => {
  it("enables the sidebar only for library and reader tabs", () => {
    expect(resolveSidebarLocation("library")).toBe("library");
    expect(resolveSidebarLocation("reader")).toBe("reader");
    expect(resolveSidebarLocation("note")).toBeNull();
    expect(resolveSidebarLocation("unknown")).toBeNull();
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
    expect(first.hostState.attachmentTarget).toBe("official");
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

  it("attaches a shared host through the Zotero library message pane render API", () => {
    const host = createFallbackSidebarHost(
      "library",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    const messagePane = new FakeLibraryMessagePane();

    expect(attachSidebarHostToLibraryFallback(messagePane, host)).toBe(true);
    expect(messagePane.renderCustomHeadCalls).toBe(1);
    expect(messagePane.rendered).toEqual([host.mountPoint]);
    expect(host.attachmentTarget).toBe("library-fallback");
  });

  it("attaches a shared host through the direct reader fallback container", () => {
    const host = createFallbackSidebarHost(
      "reader",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    const container = new FakeBody();

    expect(attachSidebarHostToReaderFallback(container, host)).toBe(true);
    expect(container.children).toEqual([host.mountPoint]);
    expect(host.attachmentTarget).toBe("reader-fallback");
  });

  it("reuses the same reader host when moving from fallback back to the official surface", () => {
    const win = new FakeWindow() as unknown as Window;
    const state: SidebarHostState = {};
    const fallbackContainer = new FakeBody();
    const officialBody = new FakeBody();

    const host = createFallbackSidebarHost(
      "reader",
      new FakeWindow().document as unknown as Pick<Document, "createElement">,
    );
    state.reader = host;

    attachSidebarHostToReaderFallback(fallbackContainer, host);
    const attached = syncSidebarHost(win, state, "reader", officialBody);

    expect(attached.hostState).toBe(host);
    expect(attached.hostState.attachmentTarget).toBe("official");
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
    expect(createdHost.bootstrapped).toBe(false);
  });
});
