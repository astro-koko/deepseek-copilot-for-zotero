import React from "react";
import { createRoot } from "react-dom/client";
import { triggerToggleChat } from "./toggleChat";
import { getPref } from "../utils/prefs";
import { EventBus } from "../utils/eventBus";
import { Sidebar } from "./components/Sidebar";

interface AIAssistantWindow extends Window {
  __aiAssistantEventBus?: EventTarget;
}

interface PanelRoots {
  library?: ReturnType<typeof createRoot>;
  reader?: ReturnType<typeof createRoot>;
}

const windowRoots = new WeakMap<Window, PanelRoots>();

export class UIFactory {
  private static toolbarFocusHandlers = new WeakMap<Window, EventListener>();

  static registerChatPanel(win: AIAssistantWindow) {
    ztoolkit.log("registerChatPanel: start");
    this.removeChatPanel(win);

    function createMountingElement(id: string, location: "library" | "reader") {
      const mountPoint = win.document.createXULElement("vbox");
      mountPoint.setAttribute("id", id);
      mountPoint.setAttribute("class", "display-flex flex-1 h-full min-w-0");
      mountPoint.setAttribute("style", "min-width: 0px; display: none;");

      const reactContainer = win.document.createElement("div");
      reactContainer.setAttribute("id", `ai-assistant-react-root-${location}`);
      reactContainer.setAttribute("data-location", location);
      reactContainer.setAttribute("class", "display-flex flex-1 flex-col h-full min-w-0");
      mountPoint.appendChild(reactContainer);

      return { mountPoint, reactContainer };
    }

    const itemPane = win.document.getElementById("zotero-item-pane");
    const contextPane = win.document.getElementById("zotero-context-pane");

    if (itemPane) {
      const { mountPoint: libraryMount, reactContainer: libraryContainer } = createMountingElement("ai-assistant-pane-library", "library");
      itemPane.appendChild(libraryMount);
      ztoolkit.log("registerChatPanel: library mount point appended");

      const roots = windowRoots.get(win) || {};
      roots.library = createRoot(libraryContainer);
      windowRoots.set(win, roots);
    }

    if (contextPane) {
      const { mountPoint: readerMount, reactContainer: readerContainer } = createMountingElement("ai-assistant-pane-reader", "reader");
      contextPane.appendChild(readerMount);
      ztoolkit.log("registerChatPanel: reader mount point appended");

      const roots = windowRoots.get(win) || {};
      roots.reader = createRoot(readerContainer);
      windowRoots.set(win, roots);
    }

    this.addToolbarButton(win);

    // Render React components
    this.renderPanels(win);
  }

  private static renderPanels(win: AIAssistantWindow) {
    const roots = windowRoots.get(win);
    if (!roots) return;

    const eventBus = EventBus.getInstance();

    if (roots.library) {
      roots.library.render(
        React.createElement(Sidebar, {
          location: "library",
          eventBus,
        })
      );
    }

    if (roots.reader) {
      roots.reader.render(
        React.createElement(Sidebar, {
          location: "reader",
          eventBus,
        })
      );
    }
  }

  static removeChatPanel(win: AIAssistantWindow) {
    ztoolkit.log("removeChatPanel called");
    try {
      if (!win?.document) return;

      this.removeToolbarFocusHandler(win);

      const roots = windowRoots.get(win);
      if (roots) {
        roots.library?.unmount();
        roots.reader?.unmount();
        windowRoots.delete(win);
      }

      const elementIds = [
        "ai-assistant-pane-library",
        "ai-assistant-pane-reader",
        "zotero-ai-assistant-tb-chat-toggle",
        "ai-assistant-tb-separator",
      ];

      elementIds.forEach((id) => {
        try {
          const element = win.document.getElementById(id);
          if (element) element.remove();
        } catch (e) {
          // Ignore
        }
      });
    } catch (error: any) {
      ztoolkit.log(`Error in removeChatPanel: ${error.message}`);
    }
  }

  private static addToolbarButton(win: AIAssistantWindow) {
    const toolbar = win.document.querySelector("#zotero-tabs-toolbar");
    if (!toolbar) return;

    const key = (getPref("keyboardShortcut") || "I").toUpperCase();
    const shortcut = Zotero.isMac ? `⌘${key}` : `Ctrl+${key}`;

    const chatToggleBtn = win.document.createXULElement("toolbarbutton");
    chatToggleBtn.setAttribute("id", "zotero-ai-assistant-tb-chat-toggle");
    chatToggleBtn.setAttribute("tooltiptext", `Toggle AI Assistant (${shortcut})`);
    chatToggleBtn.setAttribute("aria-label", "Toggle AI Assistant");
    chatToggleBtn.setAttribute("aria-pressed", "false");
    chatToggleBtn.setAttribute("tabindex", "0");
    chatToggleBtn.setAttribute("style", "-moz-user-focus: normal;");
    chatToggleBtn.addEventListener("command", () => triggerToggleChat(win));

    const syncButton = toolbar.querySelector("#zotero-tb-sync");
    const separator = toolbar.querySelector("div.zotero-tb-separator");

    if (syncButton) {
      toolbar.insertBefore(chatToggleBtn, syncButton);
      if (separator) {
        const clonedSeparator = separator.cloneNode(true) as HTMLElement;
        clonedSeparator.setAttribute("id", "ai-assistant-tb-separator");
        toolbar.insertBefore(clonedSeparator, syncButton);
      }
    } else {
      toolbar.appendChild(chatToggleBtn);
    }
  }

  private static removeToolbarFocusHandler(win: AIAssistantWindow) {
    const handler = this.toolbarFocusHandlers.get(win);
    if (!handler) return;
    const titleBar = win.document?.getElementById("zotero-title-bar");
    titleBar?.removeEventListener("keydown", handler, true);
    this.toolbarFocusHandlers.delete(win);
  }
}
