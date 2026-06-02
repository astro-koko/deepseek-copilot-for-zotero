import React from "react";
import { EventBus } from "../utils/eventBus";
import { getLocaleID } from "../utils/locale";
import { Sidebar } from "./components/Sidebar";
import {
  attachSidebarHost,
  createFallbackSidebarHost,
  resolveSidebarLocation,
  type SidebarHostState,
  type SidebarLocation,
  type SidebarSurfaceHost,
} from "./sidebarSection";
import { getCurrentScope } from "../services/scopeResolver";
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
const SURFACE_DIAGNOSTIC_PATH = "/tmp/ds-copilot-surface-state.json";

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
let reactDomClientPromise: Promise<typeof import("react-dom/client")> | null = null;

export class UIFactory {
  static registerChatPanel(win: AIAssistantWindow) {
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

    this.removeTabSelectionRefreshRegistration(win);
    windowRefreshCleanup.get(win)?.();
    windowRefreshCleanup.delete(win);
    windowCollapsedState.delete(win);
  }

  static refreshWindow(win: AIAssistantWindow) {
    const selectedType = this.getSelectedLocation(win);
    this.writeSurfaceDiagnostic(win, true, selectedType);
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
      onInit: ({ setEnabled, tabType, body }) => {
        setEnabled(this.shouldEnableSection(tabType || ""));
      },
      onItemChange: ({ setEnabled, tabType, body }) => {
        setEnabled(this.shouldEnableSection(tabType || ""));
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

  private static shouldEnableSection(tabType: string): boolean {
    return resolveSidebarLocation(tabType) != null;
  }

  private static renderSectionBody(
    body: SectionRenderBody,
    tabType: string,
  ) {
    const location = resolveSidebarLocation(tabType);
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
        new Error("DS Copilot could not access the Zotero window while rendering."),
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

    const host =
      hosts[location] ??
      {
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
      ztoolkit.log(`Failed to bootstrap DS Copilot ${location} section host:`, error);
      this.renderBootstrapFailure(host, location, error);
    });

    try {
      const sectionContainer = (body as any).parentElement ?? null;
      sectionContainer?.setAttribute?.("open", "true");
      sectionContainer?.scrollIntoView?.({
        block: "start",
      });
      (body as any).scrollIntoView?.({
        block: "start",
      });
      if (typeof (body as any).scrollTo === "function") {
        (body as any).scrollTo(0, 0);
      }
      if ("scrollTop" in (body as any)) {
        (body as any).scrollTop = 0;
      }
      if ("scrollTop" in host.mountPoint) {
        (host.mountPoint as any).scrollTop = 0;
      }
    } catch {
      // Ignore host-specific scroll reset failures.
    }
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

  private static ensureTabSelectionRefreshRegistration(win: AIAssistantWindow) {
    if (win.__aiAssistantTabObserverId) {
      return;
    }

    const callback = {
      notify: (event: string, type: string) => {
        if (event === "select" && type === "tab" && !win.closed) {
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
      ztoolkit.log("Failed to register DS Copilot tab refresh observer:", error);
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

  private static getSelectedLocation(win: AIAssistantWindow): SidebarLocation | null {
    return resolveSidebarLocation(win.Zotero_Tabs?.selectedType || "");
  }

  private static writeSurfaceDiagnostic(
    win: AIAssistantWindow,
    visible: boolean,
    selectedLocation: SidebarLocation | null,
  ) {
    try {
      const doc = win.document;
      const summarizeNode = (id: string) => {
        const element = doc.getElementById(id) as HTMLElement | null;
        if (!element) {
          return null;
        }

        const rect =
          typeof element.getBoundingClientRect === "function"
            ? element.getBoundingClientRect()
            : null;

        return {
          id,
          parent: element.parentElement?.id || element.parentElement?.tagName || null,
          display: element.style.display || "",
          hidden: Boolean(element.hidden),
          selected: element.getAttribute("selected"),
          ariaPressed: element.getAttribute("aria-pressed"),
          rect: rect
            ? {
                width: rect.width,
                height: rect.height,
              }
            : null,
          childIDs: Array.from(element.children).map(
            (child) => (child as HTMLElement).id || child.tagName,
          ),
        };
      };

      const summarizeChildren = (id: string) => {
        const element = doc.getElementById(id) as HTMLElement | null;
        if (!element) {
          return null;
        }

        return Array.from(element.children).map((child) => ({
          id: (child as HTMLElement).id || child.tagName,
          display: (child as HTMLElement).style?.display || "",
        }));
      };

      const summarizeComposer = (mountId: string) => {
        const mount = doc.getElementById(mountId) as HTMLElement | null;
        if (!mount) {
          return null;
        }

        const findFirstByTag = (node: Element | null, tagName: string): HTMLElement | null => {
          if (!node) {
            return null;
          }

          const normalizedTag = tagName.toUpperCase();
          if (node.tagName?.toUpperCase() === normalizedTag) {
            return node as HTMLElement;
          }

          for (const child of Array.from(node.children)) {
            const match = findFirstByTag(child, tagName);
            if (match) {
              return match;
            }
          }

          return null;
        };

        const collectByTag = (node: Element | null, tagName: string, matches: HTMLElement[] = []): HTMLElement[] => {
          if (!node) {
            return matches;
          }

          const normalizedTag = tagName.toUpperCase();
          if (node.tagName?.toUpperCase() === normalizedTag) {
            matches.push(node as HTMLElement);
          }

          for (const child of Array.from(node.children)) {
            collectByTag(child, tagName, matches);
          }

          return matches;
        };

        const textarea = findFirstByTag(mount, "textarea") as HTMLTextAreaElement | null;
        const buttons = collectByTag(mount, "button") as HTMLButtonElement[];
        const sendButton =
          buttons.find((button) => {
            const label = button.textContent?.trim().toLowerCase();
            return label === "send" || label === "发送";
          }) || null;

        return {
          textarea: textarea
            ? {
                disabled: textarea.disabled,
                placeholder: textarea.placeholder,
                value: textarea.value,
              }
            : null,
          sendButton: sendButton
            ? {
                disabled: sendButton.disabled,
                text: sendButton.textContent?.trim() || "",
              }
            : null,
        };
      };

      const diagnostics = (globalThis as any).__aiAssistantDiagnostics ?? {};
      const lastProviderRequest = diagnostics.lastProviderRequest ?? null;
      const composerDiagnostic = diagnostics.composer ?? null;
      const currentScope = getCurrentScope();

      // TEMP probe for daily-profile host debugging. Remove before release acceptance.
      const diagnosticTarget =
        typeof Zotero.File.pathToFile === "function"
          ? Zotero.File.pathToFile(SURFACE_DIAGNOSTIC_PATH)
          : SURFACE_DIAGNOSTIC_PATH;
      Zotero.File.putContents(
        diagnosticTarget as unknown as nsIFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            visible,
            selectedType: win.Zotero_Tabs?.selectedType || null,
            selectedID: (win.Zotero_Tabs as { selectedID?: string | number } | undefined)?.selectedID ?? null,
            resolvedLocation: selectedLocation,
            currentScope: currentScope
              ? {
                  id: currentScope.id,
                  itemIds: currentScope.itemIds,
                  label: currentScope.label,
                  readerAttachmentId: currentScope.readerAttachmentId ?? null,
                  type: currentScope.type,
                }
              : null,
            modelState: {
              lastProviderRequestEndpoint: lastProviderRequest?.endpoint ?? null,
              lastProviderRequestMessageCount:
                lastProviderRequest?.messageCount ?? null,
              lastProviderRequestModel: lastProviderRequest?.model ?? null,
            },
            composerState: composerDiagnostic
              ? {
                  disabled: composerDiagnostic.disabled ?? null,
                  input: composerDiagnostic.input ?? null,
                  isStreaming: composerDiagnostic.isStreaming ?? null,
                  sendDisabled: composerDiagnostic.sendDisabled ?? null,
                  timestamp: composerDiagnostic.timestamp ?? null,
                }
              : null,
            itemPaneChildren: summarizeChildren("zotero-item-pane"),
            contextPaneChildren: summarizeChildren("zotero-context-pane"),
            nodes: {
              itemPane: summarizeNode("zotero-item-pane"),
              contextPane: summarizeNode("zotero-context-pane"),
              contextPaneInner: summarizeNode("zotero-context-pane-inner"),
              libraryMount: summarizeNode(LIBRARY_HOST_ID),
              readerMount: summarizeNode(READER_HOST_ID),
            },
            composer: {
              library: summarizeComposer(LIBRARY_HOST_ID),
              reader: summarizeComposer(READER_HOST_ID),
            },
          },
          null,
          2,
        ),
      );
    } catch (error) {
      ztoolkit.log("Failed to write DS Copilot surface diagnostic:", error);
    }
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
    const root = (win.document.documentElement || win.document.body) as ParentNode | null;
    const staleMounts = this.collectElementsById(root, mountId).filter(
      (element) => element !== keepMount,
    );

    staleMounts.forEach((staleMount) => {
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
