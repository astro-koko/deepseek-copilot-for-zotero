import type { Root } from "react-dom/client";

export type SidebarLocation = "library" | "reader";
export type SidebarHostMount = HTMLElement;
export type SidebarAttachmentTarget =
  | "native-library"
  | "native-reader"
  | "message-head"
  | "section-body"
  | "section-fallback"
  | null;

export interface SidebarSurfaceHost {
  attachmentTarget: SidebarAttachmentTarget;
  mountPoint: SidebarHostMount;
  reactRoot: Root | null;
  reactRootElement: HTMLDivElement;
  bootstrapped: boolean;
  bootstrappingPromise: Promise<void> | null;
}

interface NativePaneLike {
  appendChild(node: unknown): unknown;
  children?: ArrayLike<unknown>;
  querySelectorAll?(selector: string): unknown;
}

export type SidebarHostState = Partial<
  Record<SidebarLocation, SidebarSurfaceHost>
>;

interface SidebarBodyLike {
  appendChild?(node: unknown): unknown;
  contains(node: unknown): boolean;
  replaceChildren(...nodes: unknown[]): void;
}

type SidebarDocumentFactory = Pick<Document, "createElement"> &
  Partial<Pick<Document, "createElementNS">> & {
    createXULElement?: (tagName: string) => unknown;
  };

export function resolveSidebarLocation(tabType: string): SidebarLocation | null {
  const normalized = `${tabType || ""}`.toLowerCase();
  if (
    normalized === "library" ||
    normalized.includes("library") ||
    isLibraryLikeTabType(normalized)
  ) {
    return "library";
  }
  if (normalized === "reader" || normalized.includes("reader")) {
    return "reader";
  }
  return null;
}

export function isSidebarLocationSelected(
  tabType: string,
  location: SidebarLocation,
): boolean {
  return resolveSidebarLocation(tabType) === location;
}

export function attachSidebarHost(
  body: SidebarBodyLike,
  host: SidebarSurfaceHost | unknown,
): boolean {
  const attachableNode = getAttachableNode(host);
  if (body.contains(attachableNode)) {
    return false;
  }

  if (typeof body.appendChild === "function") {
    body.replaceChildren();
    body.appendChild(attachableNode);
    return true;
  }

  body.replaceChildren(attachableNode);
  return true;
}

export function createFallbackSidebarHost(
  location: SidebarLocation,
  doc: SidebarDocumentFactory,
): SidebarSurfaceHost {
  return createSidebarHost(doc, location);
}

export function createSectionSidebarHost(
  location: SidebarLocation,
  doc: Pick<Document, "createElement" | "createElementNS">,
): SidebarSurfaceHost {
  return createSidebarHost(
    {
      createElement: doc.createElement.bind(doc),
      createElementNS: doc.createElementNS?.bind(doc),
    },
    location,
  );
}

export function ensureSidebarHostState(
  state: SidebarHostState | undefined,
  location: SidebarLocation,
  fallbackHost: SidebarSurfaceHost,
): SidebarSurfaceHost {
  return state?.[location] ?? fallbackHost;
}

export function syncSidebarHost(
  win: Window,
  state: SidebarHostState,
  location: SidebarLocation,
  body: SidebarBodyLike,
): { hostState: SidebarSurfaceHost; didAttach: boolean } {
  const hostState =
    state[location] ?? createSidebarHost(win.document as SidebarDocumentFactory, location);
  state[location] = hostState;
  hostState.attachmentTarget = "section-fallback";
  return {
    hostState,
    didAttach: attachSidebarHost(body, hostState),
  };
}

export function attachSidebarHostToNativePane(
  pane: NativePaneLike,
  host: SidebarSurfaceHost,
  location: SidebarLocation,
): boolean {
  const attachableNode = getAttachableNode(host);
  const previousParent =
    attachableNode &&
    typeof attachableNode === "object" &&
    "parentElement" in (attachableNode as object)
      ? ((attachableNode as { parentElement?: HTMLElement | null }).parentElement ?? null)
      : null;

  if (previousParent && previousParent !== pane) {
    setElementsVisible(listPaneSiblings(previousParent, host.mountPoint.id), true);
  }

  if (Array.isArray((pane as { children?: unknown[] }).children)) {
    const children = Array.from((pane as { children?: ArrayLike<unknown> }).children || []);
    if (children.includes(attachableNode)) {
      return false;
    }
  }

  pane.appendChild(attachableNode);
  host.attachmentTarget =
    location === "library" ? "native-library" : "native-reader";
  return true;
}

export function resolveReaderFallbackContainer(
  doc: Pick<Document, "getElementById">,
): HTMLElement | null {
  return (
    (doc.getElementById("zotero-context-pane-inner") as HTMLElement | null) ||
    (doc.getElementById("zotero-context-pane") as HTMLElement | null)
  );
}

export function getLibraryNativePane(
  doc: Pick<Document, "getElementById">,
): HTMLElement | null {
  return doc.getElementById("zotero-item-pane") as HTMLElement | null;
}

export function getReaderNativePane(
  doc: Pick<Document, "getElementById">,
): HTMLElement | null {
  return (
    (doc.getElementById("zotero-context-pane-inner") as HTMLElement | null) ||
    (doc.getElementById("zotero-context-pane") as HTMLElement | null)
  );
}

export function listPaneSiblings(
  pane: ParentNode | null,
  hostId: string,
): HTMLElement[] {
  if (!pane || !("children" in pane)) {
    return [];
  }

  return Array.from((pane as Element).children).filter(
    (child): child is HTMLElement =>
      typeof child === "object" &&
      child !== null &&
      "style" in child &&
      "id" in child &&
      (child as HTMLElement).id !== hostId,
  );
}

export function setElementsVisible(
  elements: Iterable<HTMLElement>,
  visible: boolean,
): void {
  for (const element of elements) {
    if (visible) {
      element.style.removeProperty("display");
    } else {
      element.style.display = "none";
    }
  }
}

function createSidebarHost(
  doc: SidebarDocumentFactory,
  location: SidebarLocation,
): SidebarSurfaceHost {
  const mountPoint = (doc.createXULElement?.("vbox") ??
    doc.createElement("div")) as SidebarHostMount;
  mountPoint.id = `ai-assistant-pane-${location}-mount`;
  mountPoint.className = "ai-assistant-pane-mount";

  const reactRootElement = (doc.createElementNS?.(
    "http://www.w3.org/1999/xhtml",
    "div",
  ) ?? doc.createElement("div")) as HTMLDivElement;
  reactRootElement.id = `ai-assistant-pane-${location}`;
  reactRootElement.className = "ai-assistant-pane";
  reactRootElement.dataset.location = location;
  reactRootElement.textContent = "";

  Object.assign(mountPoint.style, sharedHostStyles, {
    display: "flex",
  });
  Object.assign(reactRootElement.style, sharedHostStyles, {
    flexDirection: "column",
    height: "100%",
  });

  mountPoint.appendChild(reactRootElement);

  return {
    attachmentTarget: null,
    mountPoint,
    reactRoot: null,
    reactRootElement,
    bootstrapped: false,
    bootstrappingPromise: null,
  };
}

function getAttachableNode(host: SidebarSurfaceHost | unknown): unknown {
  if (
    host &&
    typeof host === "object" &&
    "mountPoint" in host &&
    host.mountPoint
  ) {
    return host.mountPoint;
  }
  return host;
}

const sharedHostStyles = {
  display: "flex",
  flex: "1",
  minHeight: "0",
  minWidth: "0",
  maxWidth: "100%",
  boxSizing: "border-box",
};

function isLibraryLikeTabType(tabType: string): boolean {
  return (
    tabType === "collection" ||
    tabType === "collections" ||
    tabType === "item" ||
    tabType === "items" ||
    tabType === "item-tree" ||
    tabType === "zotero-pane"
  );
}
