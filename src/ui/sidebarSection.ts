import type { Root } from "react-dom/client";

export type SidebarLocation = "library" | "reader";
export type SidebarHostMount = HTMLElement;
export type SidebarAttachmentTarget =
  | "official"
  | "library-fallback"
  | "reader-fallback"
  | null;

export interface SidebarSurfaceHost {
  attachmentTarget: SidebarAttachmentTarget;
  mountPoint: SidebarHostMount;
  reactRoot: Root | null;
  reactRootElement: HTMLDivElement;
  bootstrapped: boolean;
}

export type SidebarHostState = Partial<
  Record<SidebarLocation, SidebarSurfaceHost>
>;

interface SidebarBodyLike {
  appendChild?(node: unknown): unknown;
  contains(node: unknown): boolean;
  replaceChildren(...nodes: unknown[]): void;
}

interface LibraryFallbackPaneLike extends SidebarBodyLike {
  render?(node: unknown): unknown;
  renderCustomHead?(): void;
}

type SidebarDocumentFactory = Pick<Document, "createElement"> &
  Partial<Pick<Document, "createElementNS">> & {
    createXULElement?: (tagName: string) => unknown;
  };

export function resolveSidebarLocation(tabType: string): SidebarLocation | null {
  if (tabType === "library" || tabType === "reader") {
    return tabType;
  }
  return null;
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
  hostState.attachmentTarget = "official";
  return {
    hostState,
    didAttach: attachSidebarHost(body, hostState),
  };
}

export function attachSidebarHostToLibraryFallback(
  messagePane: LibraryFallbackPaneLike,
  host: SidebarSurfaceHost,
): boolean {
  const attachableNode = getAttachableNode(host);
  messagePane.renderCustomHead?.();

  if (typeof messagePane.render === "function") {
    messagePane.render(attachableNode);
    host.attachmentTarget = "library-fallback";
    return true;
  }

  const didAttach = attachSidebarHost(messagePane, host);
  host.attachmentTarget = "library-fallback";
  return didAttach;
}

export function attachSidebarHostToReaderFallback(
  container: SidebarBodyLike,
  host: SidebarSurfaceHost,
): boolean {
  const didAttach = attachSidebarHost(container, host);
  host.attachmentTarget = "reader-fallback";
  return didAttach;
}

export function resolveReaderFallbackContainer(
  doc: Pick<Document, "getElementById">,
): HTMLElement | null {
  return (
    (doc.getElementById("zotero-context-pane-inner") as HTMLElement | null) ||
    (doc.getElementById("zotero-context-pane") as HTMLElement | null)
  );
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
};
