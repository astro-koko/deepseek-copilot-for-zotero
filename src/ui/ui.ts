import React from "react";
import { createRoot } from "react-dom/client";
import { EventBus } from "../utils/eventBus";
import { getLocaleID } from "../utils/locale";
import { getPref } from "../utils/prefs";
import { Sidebar } from "./components/Sidebar";
import {
  attachSidebarHost,
  attachSidebarHostToNativePane,
  createFallbackSidebarHost,
  getLibraryNativePane,
  getReaderNativePane,
  listPaneSiblings,
  resolveSidebarLocation,
  setElementsVisible,
  syncSidebarHost,
  type SidebarHostState,
  type SidebarLocation,
  type SidebarSurfaceHost,
} from "./sidebarSection";
import {
  isSidebarVisible,
  registerSidebarRefreshHandler,
  setSidebarVisible,
} from "./sidebarRuntime";

interface AIAssistantWindow extends Window {
  __aiAssistantEventBus?: EventTarget;
  MozXULElement?: {
    insertFTLIfNeeded?: (path: string) => void;
  };
  ZoteroPane?: {
    getSelectedItems?: () => unknown[];
    itemPane?: {
      collapsed?: boolean;
    };
  };
  ZoteroContextPane?: {
    collapsed?: boolean;
    togglePane?: () => void;
  };
  Zotero_Tabs?: {
    selectedType?: string;
  };
}

interface SectionRenderBody {
  appendChild?(node: unknown): unknown;
  contains(node: unknown): boolean;
  ownerDocument: Document;
  replaceChildren(...nodes: unknown[]): void;
}

interface ToolbarButtonLike extends Element {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: EventListener): void;
  focus?(): void;
}

const SECTION_PANE_ID = "ai-assistant-sidebar";
const LIBRARY_HOST_ID = "ai-assistant-pane-library-mount";
const READER_HOST_ID = "ai-assistant-pane-reader-mount";
const TOGGLE_BUTTON_ID = "zotero-ai-assistant-tb-chat-toggle";
const TOGGLE_SEPARATOR_ID = "ai-assistant-tb-separator";
const LIVE_REGION_ID = "ai-assistant-live-region";

const windowHosts = new WeakMap<AIAssistantWindow, SidebarHostState>();
const windowRefreshCleanup = new WeakMap<AIAssistantWindow, () => void>();
const windowCollapsedState = new WeakMap<
  AIAssistantWindow,
  {
    library: boolean | null;
    reader: boolean | null;
  }
>();

let sectionRegistered = false;

export class UIFactory {
  static registerChatPanel(win: AIAssistantWindow) {
    this.registerSection();
    this.removeToolbarButton(win);
    this.ensureToolbarButton(win);
    this.ensureWindowRefreshRegistration(win);
    this.refreshWindow(win);
  }

  static removeChatPanel(win: AIAssistantWindow) {
    this.restoreNativePane(win, "library");
    this.restoreNativePane(win, "reader");

    const hosts = windowHosts.get(win);
    if (hosts) {
      [hosts.library, hosts.reader].forEach((hostState) => {
        hostState?.reactRoot?.unmount();
        hostState?.mountPoint.remove();
      });
      windowHosts.delete(win);
    }

    this.removeToolbarButton(win);
    windowRefreshCleanup.get(win)?.();
    windowRefreshCleanup.delete(win);
    windowCollapsedState.delete(win);
  }

  static refreshWindow(win: AIAssistantWindow) {
    this.ensureToolbarButton(win);

    const visible = isSidebarVisible();
    const selectedType = this.getSelectedLocation(win);
    const hosts = this.ensureWindowHosts(win);

    if (hosts.library) {
      this.ensureHostBootstrapped(hosts.library, "library");
    }
    if (hosts.reader) {
      this.ensureHostBootstrapped(hosts.reader, "reader");
    }

    this.attachNativeHost(win, "library");
    this.attachNativeHost(win, "reader");

    this.applyPaneVisibility(win, "library", visible && selectedType === "library");
    this.applyPaneVisibility(win, "reader", visible && selectedType === "reader");
    this.syncToolbarState(win, visible);
  }

  static refreshAllWindows() {
    for (const win of Zotero.getMainWindows()) {
      this.refreshWindow(win as AIAssistantWindow);
    }
  }

  static shutdown() {
    for (const win of Zotero.getMainWindows()) {
      try {
        this.removeChatPanel(win as AIAssistantWindow);
      } catch {
        // Ignore teardown issues while shutting down.
      }
    }

    if (sectionRegistered) {
      try {
        Zotero.ItemPaneManager.unregisterSection(SECTION_PANE_ID);
      } catch {
        // Ignore unregister failures during shutdown.
      }
      sectionRegistered = false;
    }
  }

  private static registerSection() {
    if (sectionRegistered) {
      return;
    }

    Zotero.ItemPaneManager.registerSection({
      paneID: SECTION_PANE_ID,
      pluginID: addon.data.config.addonID,
      header: {
        l10nID: getLocaleID("ai-assistant-sidebar-title"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
      },
      sidenav: {
        l10nID: getLocaleID("ai-assistant-sidebar-title"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
      },
      onInit: ({ setEnabled, tabType, body }) => {
        setEnabled(this.shouldEnableSectionFallback(body as SectionRenderBody, tabType || ""));
      },
      onItemChange: ({ setEnabled, tabType, body }) => {
        setEnabled(this.shouldEnableSectionFallback(body as SectionRenderBody, tabType || ""));
        return true;
      },
      onRender: ({ body, tabType }) => {
        this.renderSectionFallback(body as SectionRenderBody, tabType || "");
      },
      onAsyncRender: async ({ body, tabType }) => {
        this.renderSectionFallback(body as SectionRenderBody, tabType || "");
      },
    });

    sectionRegistered = true;
  }

  private static shouldEnableSectionFallback(
    body: SectionRenderBody,
    tabType: string,
  ): boolean {
    const location = resolveSidebarLocation(tabType);
    if (!location) {
      return false;
    }

    const win = body.ownerDocument.defaultView as AIAssistantWindow | null;
    if (!win) {
      return true;
    }

    return !this.hasNativePane(win, location);
  }

  private static renderSectionFallback(
    body: SectionRenderBody,
    tabType: string,
  ) {
    const location = resolveSidebarLocation(tabType);
    if (!location) {
      body.replaceChildren();
      return;
    }

    const win = body.ownerDocument.defaultView as AIAssistantWindow | null;
    if (win && this.hasNativePane(win, location)) {
      body.replaceChildren();
      return;
    }

    const host = win
      ? syncSidebarHost(
        win,
        this.ensureWindowHosts(win),
        location,
        body,
      ).hostState
      : createFallbackSidebarHost(location, body.ownerDocument);

    if (!win) {
      attachSidebarHost(body, host);
    }
    this.renderBootstrapFailure(
      host,
      location,
      new Error(
        "DS Copilot is using a compatibility section because the native sidebar host is unavailable.",
      ),
    );
  }

  private static ensureWindowRefreshRegistration(win: AIAssistantWindow) {
    if (windowRefreshCleanup.has(win)) {
      return;
    }

    const unregister = registerSidebarRefreshHandler(() => {
      if (!win.closed) {
        this.refreshWindow(win);
      }
    });
    windowRefreshCleanup.set(win, unregister);
  }

  private static ensureWindowHosts(win: AIAssistantWindow): SidebarHostState {
    const existing = windowHosts.get(win);
    if (existing) {
      return existing;
    }

    const nextHosts: SidebarHostState = {};
    windowHosts.set(win, nextHosts);
    return nextHosts;
  }

  private static ensureCollapsedState(win: AIAssistantWindow) {
    const existing = windowCollapsedState.get(win);
    if (existing) {
      return existing;
    }

    const nextState = {
      library: null,
      reader: null,
    };
    windowCollapsedState.set(win, nextState);
    return nextState;
  }

  private static getOrCreateHost(
    win: AIAssistantWindow,
    location: SidebarLocation,
  ): SidebarSurfaceHost {
    const hosts = this.ensureWindowHosts(win);
    const existing = hosts[location];
    if (existing) {
      return existing;
    }

    const host = createFallbackSidebarHost(
      location,
      win.document as unknown as Document,
    );
    hosts[location] = host;
    return host;
  }

  private static ensureHostBootstrapped(
    hostState: SidebarSurfaceHost,
    location: SidebarLocation,
  ) {
    if (!hostState.reactRoot) {
      hostState.reactRoot = createRoot(hostState.reactRootElement);
    }

    if (hostState.bootstrapped) {
      return;
    }

    hostState.reactRoot.render(
      React.createElement(Sidebar, {
        eventBus: EventBus.getInstance(),
        location,
      }),
    );
    hostState.bootstrapped = true;
  }

  private static attachNativeHost(
    win: AIAssistantWindow,
    location: SidebarLocation,
  ): SidebarSurfaceHost | null {
    const pane = this.getNativePane(win, location);
    if (!pane) {
      return null;
    }

    const host = this.getOrCreateHost(win, location);
    this.removeStaleMounts(win, host.mountPoint.id, host.mountPoint);
    attachSidebarHostToNativePane(pane, host, location);
    this.ensureHostBootstrapped(host, location);
    return host;
  }

  private static getNativePane(
    win: AIAssistantWindow,
    location: SidebarLocation,
  ): HTMLElement | null {
    return location === "library"
      ? getLibraryNativePane(win.document)
      : getReaderNativePane(win.document);
  }

  private static hasNativePane(
    win: AIAssistantWindow,
    location: SidebarLocation,
  ): boolean {
    return this.getNativePane(win, location) != null;
  }

  private static applyPaneVisibility(
    win: AIAssistantWindow,
    location: SidebarLocation,
    visible: boolean,
  ): void {
    const pane = this.getNativePane(win, location);
    const host = windowHosts.get(win)?.[location];
    if (!pane || !host) {
      return;
    }

    const siblingId = location === "library" ? LIBRARY_HOST_ID : READER_HOST_ID;
    const siblings = listPaneSiblings(pane, siblingId);
    setElementsVisible(siblings, !visible);

    const mount = host.mountPoint;
    if (visible) {
      mount.style.display = "flex";
    } else {
      mount.style.display = "none";
    }

    if (location === "library") {
      this.syncLibraryCollapsedState(win, visible);
    } else {
      this.syncReaderCollapsedState(win, visible);
    }
  }

  private static restoreNativePane(win: AIAssistantWindow, location: SidebarLocation) {
    const pane = this.getNativePane(win, location);
    const host = windowHosts.get(win)?.[location];
    if (!host) {
      return;
    }

    const siblingId = location === "library" ? LIBRARY_HOST_ID : READER_HOST_ID;
    const parents = new Set<ParentNode | null>([
      pane,
      host.mountPoint.parentElement,
    ]);

    parents.forEach((parent) => {
      setElementsVisible(listPaneSiblings(parent, siblingId), true);
    });
    host.mountPoint.style.display = "none";

    if (location === "library") {
      this.syncLibraryCollapsedState(win, false);
    } else {
      this.syncReaderCollapsedState(win, false);
    }
  }

  private static syncLibraryCollapsedState(
    win: AIAssistantWindow,
    visible: boolean,
  ): void {
    const itemPane = win.ZoteroPane?.itemPane;
    if (!itemPane) {
      return;
    }

    const collapseState = this.ensureCollapsedState(win);

    if (visible) {
      if (collapseState.library == null) {
        collapseState.library = Boolean(itemPane.collapsed);
      }
      if (itemPane.collapsed) {
        itemPane.collapsed = false;
      }
      return;
    }

    if (collapseState.library) {
      itemPane.collapsed = true;
    }
    collapseState.library = null;
  }

  private static syncReaderCollapsedState(
    win: AIAssistantWindow,
    visible: boolean,
  ): void {
    const contextPane = win.ZoteroContextPane;
    if (!contextPane) {
      return;
    }

    const collapseState = this.ensureCollapsedState(win);

    if (visible) {
      if (collapseState.reader == null) {
        collapseState.reader = Boolean(contextPane.collapsed);
      }
      if (contextPane.collapsed) {
        contextPane.togglePane?.();
      }
      return;
    }

    if (collapseState.reader && !contextPane.collapsed) {
      contextPane.togglePane?.();
    }
    collapseState.reader = null;
  }

  private static getSelectedLocation(win: AIAssistantWindow): SidebarLocation | null {
    return resolveSidebarLocation(win.Zotero_Tabs?.selectedType || "");
  }

  private static ensureToolbarButton(win: AIAssistantWindow) {
    if (win.document.getElementById(TOGGLE_BUTTON_ID)) {
      return;
    }

    const toolbar = win.document.querySelector("#zotero-tabs-toolbar");
    if (!toolbar) {
      return;
    }

    const shortcutKey = String(getPref("keyboardShortcut") || "I").toUpperCase();
    const shortcut = Zotero.isMac ? `⌘${shortcutKey}` : `Ctrl+${shortcutKey}`;
    const usingXULButton = typeof win.document.createXULElement === "function";
    const toggleBtn = win.document.createXULElement?.("toolbarbutton") ??
      win.document.createElement("button");
    toggleBtn.setAttribute("id", TOGGLE_BUTTON_ID);
    toggleBtn.setAttribute("label", "DS Copilot");
    toggleBtn.setAttribute(
      "tooltiptext",
      `Toggle DS Copilot (${shortcut})`,
    );
    toggleBtn.setAttribute("aria-label", "Toggle DS Copilot");
    toggleBtn.setAttribute("aria-pressed", String(isSidebarVisible()));
    const onToggle = () => {
      const nextVisible = !isSidebarVisible();
      this.syncToolbarState(win, nextVisible);
      this.announceSidebarState(win, nextVisible);
      if (!nextVisible) {
        (toggleBtn as ToolbarButtonLike).focus?.();
      }
      setSidebarVisible(nextVisible);
    };

    toggleBtn.addEventListener(usingXULButton ? "command" : "click", onToggle);

    const separator = win.document.createXULElement?.("toolbarseparator") ??
      win.document.createElement("div");
    separator.setAttribute("id", TOGGLE_SEPARATOR_ID);

    toolbar.appendChild(separator);
    toolbar.appendChild(toggleBtn);
  }

  private static removeToolbarButton(win: AIAssistantWindow) {
    win.document.getElementById(TOGGLE_BUTTON_ID)?.remove();
    win.document.getElementById(TOGGLE_SEPARATOR_ID)?.remove();
    win.document.getElementById(LIVE_REGION_ID)?.remove();
  }

  private static syncToolbarState(win: AIAssistantWindow, visible: boolean) {
    const toggleBtn = win.document.getElementById(TOGGLE_BUTTON_ID) as ToolbarButtonLike | null;
    if (!toggleBtn) {
      return;
    }
    toggleBtn.setAttribute("aria-pressed", String(visible));
    if (visible) {
      toggleBtn.setAttribute("selected", "true");
    } else {
      toggleBtn.removeAttribute("selected");
    }
  }

  private static announceSidebarState(win: AIAssistantWindow, visible: boolean) {
    const region = this.ensureLiveRegion(win);
    if (!region) {
      return;
    }

    region.textContent = "";
    const message = visible ? "DS Copilot panel opened" : "DS Copilot panel closed";
    win.setTimeout(() => {
      region.textContent = message;
    }, 50);
  }

  private static ensureLiveRegion(win: AIAssistantWindow): HTMLElement | null {
    let region = win.document.getElementById(LIVE_REGION_ID) as HTMLElement | null;
    if (region) {
      return region;
    }

    region = win.document.createElement("div");
    region.id = LIVE_REGION_ID;
    region.setAttribute("aria-live", "polite");
    region.setAttribute("role", "status");
    region.setAttribute("aria-atomic", "true");
    region.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    (win.document.documentElement || win.document.body || win.document).appendChild(region);
    return region;
  }

  private static removeStaleMounts(
    win: AIAssistantWindow,
    mountId: string,
    keepMount: HTMLElement,
  ) {
    const root = (win.document.documentElement || win.document.body) as ParentNode | null;
    const staleMounts = this.collectElementsById(root, mountId).filter(
      (element) => element !== keepMount,
    );

    staleMounts.forEach((staleMount) => {
      const parent = staleMount.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child): child is HTMLElement =>
            child !== staleMount &&
            typeof child === "object" &&
            child !== null &&
            "style" in child,
        );
        setElementsVisible(siblings, true);
      }
      staleMount.remove();
    });
  }

  private static collectElementsById(
    root: ParentNode | null,
    id: string,
  ): HTMLElement[] {
    if (!root || !("children" in root)) {
      return [];
    }

    const matches: HTMLElement[] = [];
    const stack = Array.from((root as Element).children);

    while (stack.length > 0) {
      const next = stack.shift();
      if (
        !next ||
        typeof next !== "object" ||
        !("children" in next)
      ) {
        continue;
      }

      if ((next as HTMLElement).id === id) {
        matches.push(next as HTMLElement);
      }

      stack.unshift(...Array.from((next as Element).children));
    }

    return matches;
  }

  private static renderBootstrapFailure(
    hostState: SidebarSurfaceHost,
    location: SidebarLocation,
    error: unknown,
  ) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unknown sidebar bootstrap failure";

    if (hostState.reactRoot) {
      try {
        hostState.reactRoot.render(
          React.createElement(SectionErrorCard, { location, message }),
        );
        return;
      } catch {
        // Fall back to direct DOM content below.
      }
    }

    const root = hostState.reactRootElement;
    const doc = root.ownerDocument;
    if (!doc) {
      root.textContent = message;
      return;
    }
    root.replaceChildren();

    const title = doc.createElement("div");
    title.textContent = `${location === "reader" ? "Reader" : "Library"} panel unavailable`;
    Object.assign(title.style, {
      color: "#7f1d1d",
      fontSize: "14px",
      fontWeight: "700",
      marginBottom: "8px",
    });

    const detail = doc.createElement("div");
    detail.textContent = message;
    Object.assign(detail.style, {
      color: "#991b1b",
      fontSize: "12px",
      lineHeight: "1.5",
    });

    Object.assign(root.style, {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      borderRadius: "14px",
      boxSizing: "border-box",
      margin: "12px",
      padding: "12px",
    });
    root.appendChild(title);
    root.appendChild(detail);
  }
}

function SectionErrorCard({
  location,
  message,
}: {
  location: SidebarLocation;
  message: string;
}) {
  return React.createElement(
    "div",
    {
      style: {
        background: "#fff1f2",
        border: "1px solid #fecdd3",
        borderRadius: "14px",
        boxSizing: "border-box",
        color: "#881337",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        height: "100%",
        margin: "12px",
        padding: "14px",
      },
    },
    React.createElement(
      "div",
      {
        style: {
          fontSize: "14px",
          fontWeight: 700,
        },
      },
      `${location === "reader" ? "Reader" : "Library"} sidebar fallback`,
    ),
    React.createElement(
      "div",
      {
        style: {
          fontSize: "12px",
          lineHeight: 1.5,
        },
      },
      message,
    ),
  );
}
