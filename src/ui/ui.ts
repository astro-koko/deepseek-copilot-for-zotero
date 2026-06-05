import React from "react";
import { EventBus } from "../utils/eventBus";
import { getLocaleID } from "../utils/locale";
import { Sidebar } from "./components/Sidebar";
import { getCurrentScope } from "../services/scopeResolver";
import {
  attachSidebarHost,
  createFallbackSidebarHost,
  resolveSidebarLocation,
  type SidebarHostState,
  type SidebarLocation,
  type SidebarSurfaceHost,
} from "./sidebarSection";
import { registerSidebarRefreshHandler } from "./sidebarRuntime";

interface AIAssistantWindow extends Window {
  __aiAssistantEventBus?: EventTarget;
  __aiAssistantTabObserverId?: string | null;
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

const SECTION_PANE_ID = "ai-assistant-sidebar";
const LIBRARY_HOST_ID = "ai-assistant-pane-library-mount";
const READER_HOST_ID = "ai-assistant-pane-reader-mount";
const LEGACY_STANDALONE_ARTIFACT_IDS = [
  "ai-assistant-library-empty-state",
  "ai-assistant-library-empty-state-sidenav-btn",
  "zotero-ai-assistant-tb-chat-toggle",
];

const windowHosts = new WeakMap<AIAssistantWindow, SidebarHostState>();
const windowRefreshCleanup = new WeakMap<AIAssistantWindow, () => void>();
const windowSectionRefresh = new WeakMap<
  AIAssistantWindow,
  () => Promise<void>
>();
const windowScopeRetryTimer = new WeakMap<AIAssistantWindow, number>();

let sectionRegistered = false;
let reactDomClientPromise: Promise<typeof import("react-dom/client")> | null =
  null;

export class UIFactory {
  static registerChatPanel(win: AIAssistantWindow) {
    this.removeLegacyStandaloneArtifacts(win);
    this.registerSection();
    this.ensureWindowRefreshRegistration(win);
    this.ensureTabSelectionRefreshRegistration(win);
    this.refreshWindow(win);
  }

  static removeChatPanel(win: AIAssistantWindow) {
    const hosts = windowHosts.get(win);
    if (hosts) {
      [hosts.library, hosts.reader].forEach((hostState) => {
        hostState?.reactRoot?.unmount();
        if (hostState?.attachmentTarget !== "section-body") {
          hostState?.mountPoint.remove();
        }
      });
      windowHosts.delete(win);
    }

    this.clearScopeRetryTimer(win);
    this.removeTabSelectionRefreshRegistration(win);
    windowRefreshCleanup.get(win)?.();
    windowRefreshCleanup.delete(win);
    windowSectionRefresh.delete(win);
    this.removeLegacyStandaloneArtifacts(win);
  }

  static refreshWindow(win: AIAssistantWindow) {
    void win;
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
        l10nID: getLocaleID("ai-assistant-sidebar-sidenav"),
        icon: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
      },
      onInit: ({ setEnabled, tabType, body, refresh }) => {
        setEnabled(
          this.shouldEnableSection(tabType || "", body as SectionRenderBody),
        );
        this.registerSectionRefresh(body as SectionRenderBody, refresh);
      },
      onItemChange: ({ setEnabled, tabType, body }) => {
        setEnabled(
          this.shouldEnableSection(tabType || "", body as SectionRenderBody),
        );
        this.syncSectionScope(body as SectionRenderBody, tabType || "");
        return true;
      },
      onRender: ({ body, tabType }) => {
        this.renderSectionBody(body as SectionRenderBody, tabType || "");
      },
      onAsyncRender: async ({ body, tabType }) => {
        this.renderSectionBody(body as SectionRenderBody, tabType || "");
      },
    });

    sectionRegistered = true;
  }

  private static shouldEnableSection(
    tabType: string,
    body?: SectionRenderBody,
  ): boolean {
    return this.resolveSectionLocation(tabType, body) != null;
  }

  private static renderSectionBody(body: SectionRenderBody, tabType: string) {
    const location = this.resolveSectionLocation(tabType, body);
    if (!location) {
      body.replaceChildren();
      return;
    }

    const win = body.ownerDocument.defaultView as AIAssistantWindow | null;
    if (!win) {
      const host = createFallbackSidebarHost(location, body.ownerDocument);
      attachSidebarHost(body, host);
      this.renderBootstrapFailure(
        host,
        location,
        new Error(
          "DS Copilot could not access the Zotero window while rendering.",
        ),
      );
      return;
    }

    const hosts = this.ensureWindowHosts(win);
    const existing = hosts[location];
    const sectionBody = body as unknown as HTMLDivElement;
    if (existing && existing.mountPoint !== sectionBody) {
      existing.reactRoot?.unmount();
      delete hosts[location];
    }

    const host = hosts[location] ?? {
      attachmentTarget: "section-body" as const,
      mountPoint: sectionBody,
      reactRoot: null,
      reactRootElement: sectionBody,
      bootstrapped: false,
      bootstrappingPromise: null,
    };
    host.attachmentTarget = "section-body";
    hosts[location] = host;

    host.mountPoint.style.display = "flex";

    void this.ensureHostBootstrapped(win, host, location).catch((error) => {
      ztoolkit.log(
        `Failed to bootstrap DS Copilot ${location} section host:`,
        error,
      );
      this.renderBootstrapFailure(host, location, error);
    });
  }

  private static ensureWindowRefreshRegistration(win: AIAssistantWindow) {
    if (windowRefreshCleanup.has(win)) {
      return;
    }

    const unregister = registerSidebarRefreshHandler(() => {
      if (!win.closed) {
        void this.requestSectionRefresh(win);
        this.refreshWindow(win);
      }
    });
    windowRefreshCleanup.set(win, unregister);
  }

  private static ensureTabSelectionRefreshRegistration(win: AIAssistantWindow) {
    if (win.__aiAssistantTabObserverId) {
      return;
    }

    const callback = {
      notify: (event: string, type: string) => {
        if (event === "select" && type === "tab" && !win.closed) {
          void this.requestSectionRefresh(win);
          this.refreshWindow(win);
        }
      },
    };

    try {
      win.__aiAssistantTabObserverId = Zotero.Notifier.registerObserver(
        callback,
        ["tab"],
        `${addon.data.config.addonID}-ui-tab-refresh`,
      );
    } catch (error) {
      ztoolkit.log(
        "Failed to register DS Copilot tab refresh observer:",
        error,
      );
      win.__aiAssistantTabObserverId = null;
    }
  }

  private static removeTabSelectionRefreshRegistration(win: AIAssistantWindow) {
    const observerId = win.__aiAssistantTabObserverId;
    if (!observerId) {
      return;
    }

    try {
      Zotero.Notifier.unregisterObserver(observerId);
    } catch {
      // Ignore stale observer cleanup errors.
    }
    win.__aiAssistantTabObserverId = null;
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

  private static registerSectionRefresh(
    body: SectionRenderBody,
    refresh: (() => Promise<void>) | undefined,
  ) {
    if (!refresh) {
      return;
    }

    const win = body.ownerDocument.defaultView as AIAssistantWindow | null;
    if (!win) {
      return;
    }

    windowSectionRefresh.set(win, refresh);
  }

  private static syncSectionScope(body: SectionRenderBody, tabType: string) {
    const win = body.ownerDocument.defaultView as AIAssistantWindow | null;
    const eventBus = win?.__aiAssistantEventBus ?? EventBus.getInstance();
    const initialScope = getCurrentScope();
    this.dispatchScopeChange(eventBus, initialScope);

    if (!win || this.resolveSectionLocation(tabType, body) !== "library") {
      return;
    }

    this.clearScopeRetryTimer(win);
    const retryTimer = win.setTimeout(() => {
      this.clearScopeRetryTimer(win);
      const retriedScope = getCurrentScope();
      if (!this.areScopesEquivalent(initialScope, retriedScope)) {
        this.dispatchScopeChange(eventBus, retriedScope);
      }
    }, 100);
    windowScopeRetryTimer.set(win, retryTimer);
  }

  private static dispatchScopeChange(
    eventBus: EventTarget,
    scope: ReturnType<typeof getCurrentScope>,
  ) {
    eventBus.dispatchEvent(
      new CustomEvent("scopeChange", {
        detail: scope,
      }),
    );
  }

  private static areScopesEquivalent(
    left: ReturnType<typeof getCurrentScope>,
    right: ReturnType<typeof getCurrentScope>,
  ): boolean {
    return left?.type === right?.type && left?.id === right?.id;
  }

  private static clearScopeRetryTimer(win: AIAssistantWindow) {
    const retryTimer = windowScopeRetryTimer.get(win);
    if (retryTimer == null) {
      return;
    }

    win.clearTimeout(retryTimer);
    windowScopeRetryTimer.delete(win);
  }

  private static async requestSectionRefresh(
    win: AIAssistantWindow,
  ): Promise<void> {
    try {
      await windowSectionRefresh.get(win)?.();
    } catch (error) {
      ztoolkit.log("Failed to refresh DS Copilot section state:", error);
    }
  }

  private static ensureHostBootstrapped(
    win: AIAssistantWindow,
    hostState: SidebarSurfaceHost,
    location: SidebarLocation,
  ): Promise<void> {
    if (hostState.bootstrapped) {
      return Promise.resolve();
    }

    if (hostState.bootstrappingPromise) {
      return hostState.bootstrappingPromise;
    }

    hostState.bootstrappingPromise = (async () => {
      const { createRoot } = await this.getReactDomClient(win);
      if (!hostState.reactRoot) {
        hostState.reactRoot = createRoot(hostState.reactRootElement);
      }

      hostState.reactRoot.render(
        React.createElement(Sidebar, {
          eventBus: EventBus.getInstance(),
          hostWindow: win,
          location,
        }),
      );
      hostState.bootstrapped = true;
    })()
      .catch((error) => {
        hostState.reactRoot?.unmount();
        hostState.reactRoot = null;
        hostState.bootstrapped = false;
        throw error;
      })
      .finally(() => {
        hostState.bootstrappingPromise = null;
      });

    return hostState.bootstrappingPromise;
  }

  private static resolveSectionLocation(
    tabType: string,
    body?: SectionRenderBody,
  ): SidebarLocation | null {
    const direct = resolveSidebarLocation(tabType);
    if (direct) {
      return direct;
    }

    const win = body?.ownerDocument?.defaultView as
      | AIAssistantWindow
      | null
      | undefined;
    return win ? this.getSelectedLocation(win) : null;
  }

  private static getSelectedLocation(
    win: AIAssistantWindow,
  ): SidebarLocation | null {
    return resolveSidebarLocation(win.Zotero_Tabs?.selectedType || "");
  }

  private static async getReactDomClient(win: AIAssistantWindow) {
    if (!reactDomClientPromise) {
      this.bindDomGlobals(win);
      reactDomClientPromise = import("react-dom/client");
    }
    return reactDomClientPromise;
  }

  private static bindDomGlobals(win: AIAssistantWindow) {
    const globalScope = globalThis as typeof globalThis & {
      document?: Document;
      navigator?: Navigator;
      window?: Window;
    };

    if (!globalScope.window) {
      globalScope.window = win;
    }
    if (!globalScope.document) {
      globalScope.document = win.document;
    }
    if (!globalScope.navigator && "navigator" in win) {
      globalScope.navigator = win.navigator;
    }
  }

  private static removeStaleMounts(
    win: AIAssistantWindow,
    mountId: string,
    keepMount: HTMLElement,
  ) {
    const root = (win.document.documentElement ||
      win.document.body) as ParentNode | null;
    const staleMounts = this.collectElementsById(root, mountId).filter(
      (element) => element !== keepMount,
    );

    staleMounts.forEach((staleMount) => {
      staleMount.remove();
    });
  }

  private static removeLegacyStandaloneArtifacts(win: AIAssistantWindow) {
    const root = (win.document.documentElement ||
      win.document.body) as ParentNode | null;
    for (const artifactId of LEGACY_STANDALONE_ARTIFACT_IDS) {
      this.collectElementsById(root, artifactId).forEach((element) => {
        element.remove();
      });
    }
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
      if (!next || typeof next !== "object" || !("children" in next)) {
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
