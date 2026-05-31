import React from "react";
import { createRoot } from "react-dom/client";
import { EventBus } from "../utils/eventBus";
import { getLocaleID } from "../utils/locale";
import { Sidebar } from "./components/Sidebar";
import {
  attachSidebarHost,
  attachSidebarHostToLibraryFallback,
  attachSidebarHostToReaderFallback,
  createFallbackSidebarHost,
  resolveSidebarLocation,
  resolveReaderFallbackContainer,
  syncSidebarHost,
  type SidebarHostState,
  type SidebarLocation,
  type SidebarSurfaceHost,
} from "./sidebarSection";

interface AIAssistantWindow extends Window {
  __aiAssistantEventBus?: EventTarget;
}

interface SectionRenderBody {
  appendChild?(node: unknown): unknown;
  contains(node: unknown): boolean;
  ownerDocument: Document;
  replaceChildren(...nodes: unknown[]): void;
}

interface LibraryMessagePaneElement extends HTMLElement {
  render?(node: unknown): unknown;
  renderCustomHead?(): void;
}

const SECTION_PANE_ID = "ai-assistant-sidebar";
const windowHosts = new WeakMap<AIAssistantWindow, SidebarHostState>();

let sectionRegistered = false;

export class UIFactory {
  static registerChatPanel(win: AIAssistantWindow) {
    this.registerSection();
    this.removeLegacyElements(win);
    this.refreshWindow(win);
  }

  static removeChatPanel(win: AIAssistantWindow) {
    const hosts = windowHosts.get(win);
    if (hosts) {
      [hosts.library, hosts.reader].forEach((hostState) => {
        hostState?.reactRoot?.unmount();
        hostState?.mountPoint.remove();
      });
      windowHosts.delete(win);
    }

    this.removeLegacyElements(win);
  }

  static refreshWindow(win: AIAssistantWindow) {
    this.removeLegacyElements(win);

    if (this.shouldUseLibraryFallback(win)) {
      this.attachLibraryFallback(win);
      return;
    }

    if (this.shouldUseReaderFallback(win)) {
      this.attachReaderFallback(win);
      return;
    }

    this.normalizeReaderSurface(win);
  }

  static refreshAllWindows() {
    for (const win of Zotero.getMainWindows()) {
      this.refreshWindow(win as AIAssistantWindow);
    }
  }

  static shutdown() {
    if (!sectionRegistered) {
      return;
    }

    try {
      Zotero.ItemPaneManager.unregisterSection(SECTION_PANE_ID);
    } catch (_error) {
      // Ignore unregister failures during shutdown.
    }

    sectionRegistered = false;
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
      onInit: ({ setEnabled, tabType }) => {
        setEnabled(resolveSidebarLocation(tabType || "") != null);
      },
      onItemChange: ({ setEnabled, tabType }) => {
        setEnabled(resolveSidebarLocation(tabType || "") != null);
        return true;
      },
      onRender: ({ body, tabType }) => {
        const location = resolveSidebarLocation(tabType || "");
        if (!location) {
          body.replaceChildren();
          return;
        }

        try {
          this.attachSectionHost(body as SectionRenderBody, location);
        } catch (error) {
          this.renderSectionFailureBody(body as SectionRenderBody, location, error);
        }
      },
      onAsyncRender: async ({ body, tabType }) => {
        const location = resolveSidebarLocation(tabType || "");
        if (!location) {
          body.replaceChildren();
          return;
        }

        this.bootstrapSection(body as SectionRenderBody, location);
      },
    });

    sectionRegistered = true;
  }

  private static attachSectionHost(
    body: SectionRenderBody,
    location: SidebarLocation,
  ): SidebarSurfaceHost | null {
    const doc = body.ownerDocument;
    const win = doc.defaultView as AIAssistantWindow | null;

    if (!win) {
      const fallbackHost = createFallbackSidebarHost(location, doc);
      attachSidebarHost(body, fallbackHost);
      this.renderBootstrapFailure(
        fallbackHost,
        location,
        new Error("No Zotero window was available for the sidebar section."),
      );
      return fallbackHost;
    }

    const hosts = this.ensureWindowHosts(win);
    const { hostState } = syncSidebarHost(win, hosts, location, body);
    return hostState;
  }

  private static bootstrapSection(
    body: SectionRenderBody,
    location: SidebarLocation,
  ) {
    let hostState: SidebarSurfaceHost | null;
    try {
      hostState = this.attachSectionHost(body, location);
    } catch (error) {
      this.renderSectionFailureBody(body, location, error);
      return;
    }

    if (!hostState) {
      return;
    }

    try {
      this.bootstrapHostState(hostState, location);
    } catch (error) {
      hostState.bootstrapped = false;
      this.renderBootstrapFailure(hostState, location, error);
    }
  }

  private static bootstrapHostState(
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

  private static ensureWindowHosts(win: AIAssistantWindow): SidebarHostState {
    const existing = windowHosts.get(win);
    if (existing) {
      return existing;
    }

    const nextHosts: SidebarHostState = {};
    windowHosts.set(win, nextHosts);
    return nextHosts;
  }

  private static attachLibraryFallback(win: AIAssistantWindow) {
    const messagePane = win.document.getElementById(
      "zotero-item-message",
    ) as LibraryMessagePaneElement | null;
    if (!messagePane) {
      return;
    }

    const hosts = this.ensureWindowHosts(win);
    const hostState =
      hosts.library ??
      createFallbackSidebarHost("library", win.document as unknown as Document);
    hosts.library = hostState;

    try {
      attachSidebarHostToLibraryFallback(messagePane, hostState);
      this.bootstrapHostState(hostState, "library");
    } catch (error) {
      hostState.bootstrapped = false;
      this.renderBootstrapFailure(hostState, "library", error);
    }
  }

  private static shouldUseLibraryFallback(win: AIAssistantWindow): boolean {
    const selectedType = (win as any).Zotero_Tabs?.selectedType;
    if (selectedType !== "library") {
      return false;
    }

    const selectedItems = (win as any).ZoteroPane?.getSelectedItems?.() || [];
    return selectedItems.length === 0;
  }

  private static shouldUseReaderFallback(win: AIAssistantWindow): boolean {
    const selectedType = (win as any).Zotero_Tabs?.selectedType;
    if (selectedType !== "reader") {
      return false;
    }

    const readerHost = windowHosts.get(win)?.reader;
    return readerHost?.attachmentTarget !== "official";
  }

  private static attachReaderFallback(win: AIAssistantWindow) {
    const container = resolveReaderFallbackContainer(win.document);
    if (!container) {
      return;
    }

    const hosts = this.ensureWindowHosts(win);
    const hostState =
      hosts.reader ??
      createFallbackSidebarHost("reader", win.document as unknown as Document);
    hosts.reader = hostState;

    try {
      attachSidebarHostToReaderFallback(container, hostState);
      this.bootstrapHostState(hostState, "reader");
    } catch (error) {
      hostState.bootstrapped = false;
      this.renderBootstrapFailure(hostState, "reader", error);
    }
  }

  private static normalizeReaderSurface(win: AIAssistantWindow) {
    const selectedType = (win as any).Zotero_Tabs?.selectedType;
    if (selectedType !== "reader") {
      return;
    }

    const hosts = windowHosts.get(win);
    const readerHost = hosts?.reader;
    if (!readerHost || readerHost.attachmentTarget !== "reader-fallback") {
      return;
    }

    const container = resolveReaderFallbackContainer(win.document);
    if (!container) {
      return;
    }

    container.appendChild(readerHost.mountPoint);
  }

  private static renderSectionFailureBody(
    body: SectionRenderBody,
    location: SidebarLocation,
    error: unknown,
  ) {
    const fallbackHost = createFallbackSidebarHost(location, body.ownerDocument);
    try {
      attachSidebarHost(body, fallbackHost);
    } catch (_attachError) {
      return;
    }
    this.renderBootstrapFailure(fallbackHost, location, error);
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
      } catch (_renderError) {
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

  private static removeLegacyElements(win: AIAssistantWindow) {
    [
      "ai-assistant-pane-library-panel",
      "ai-assistant-pane-reader-panel",
      "ai-assistant-sidenav-button-library",
      "ai-assistant-sidenav-button-reader",
      "ai-assistant-sidenav-wrapper-library",
      "ai-assistant-sidenav-wrapper-reader",
      "ai-assistant-sidenav-divider-library",
      "ai-assistant-sidenav-divider-reader",
      "zotero-ai-assistant-tb-chat-toggle",
      "ai-assistant-tb-separator",
    ].forEach((id) => {
      win.document.getElementById(id)?.remove();
    });
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
      `${location === "reader" ? "Reader" : "Library"} sidebar failed to load`,
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
