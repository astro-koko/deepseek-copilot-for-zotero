import { initLocale } from "./utils/locale";
import { config } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";
import { UIFactory } from "./ui/ui";
import { initReaderIntegration, cleanupReaderIntegration } from "./modules/readerIntegration";
import { initDatabase, closeDatabase } from "./services/persistence";
import { registerScopeNotifier, unregisterScopeNotifier } from "./services/scopeResolver";
import { EventBus } from "./utils/eventBus";

let scopeChangeCallback: ((scope: any) => void) | null = null;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  ztoolkit.log("Startup");

  // Initialize database
  try {
    await initDatabase();
    ztoolkit.log("Database initialized");
  } catch (e) {
    ztoolkit.log("Database init failed:", e);
  }

  // Register reader integration
  initReaderIntegration();

  // Register preferences pane
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
    id: `${addon.data.config.addonRef}-prefpane`,
    label: "AI Assistant",
    image: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
  });

  // Load UI for all windows
  const mainWindows = Zotero.getMainWindows();
  if (mainWindows.length > 0) {
    await Promise.all(mainWindows.map((win) => onMainWindowLoad(win)));
  }
}

function loadStylesheet() {
  const styleURI = `chrome://${addon.data.config.addonRef}/content/styles.css`;
  const ssService = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const styleSheet = Services.io.newURI(styleURI);
  const sheetType = Ci.nsIStyleSheetService.AUTHOR_SHEET!;
  if (ssService.sheetRegistered(styleSheet, sheetType)) {
    ssService.unregisterSheet(styleSheet, sheetType);
  }
  ssService.loadAndRegisterSheet(styleSheet, sheetType);
}

function unloadStylesheet() {
  const styleURI = `chrome://${addon.data.config.addonRef}/content/styles.css`;
  const ssService = Cc["@mozilla.org/content/style-sheet-service;1"]
    .getService(Ci.nsIStyleSheetService);
  const styleSheet = Services.io.newURI(styleURI);
  const sheetType = Ci.nsIStyleSheetService.AUTHOR_SHEET!;
  if (ssService.sheetRegistered(styleSheet, sheetType)) {
    ssService.unregisterSheet(styleSheet, sheetType);
  }
}

async function onMainWindowLoad(win: Window): Promise<void> {
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement?.insertFTLIfNeeded?.(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Setup event bus on window
  (win as any).__aiAssistantEventBus = EventBus.getInstance();

  loadStylesheet();
  UIFactory.registerChatPanel(win);

  // Register scope notifier
  if (!scopeChangeCallback) {
    scopeChangeCallback = (scope) => {
      const eventBus = (win as any).__aiAssistantEventBus;
      if (eventBus) {
        eventBus.dispatchEvent(new win.CustomEvent("scopeChange", { detail: scope }));
      }
    };
    registerScopeNotifier(scopeChangeCallback);
  }

  ztoolkit.log("UI ready");
}

async function onMainWindowUnload(win: Window): Promise<void> {
  UIFactory.removeChatPanel(win);
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

async function onShutdown(): Promise<void> {
  unregisterScopeNotifier();
  cleanupReaderIntegration();

  try {
    await closeDatabase();
  } catch (e) {
    ztoolkit.log("Database close error:", e);
  }

  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  addon.data.alive = false;

  try {
    delete (Zotero as any)[addon.data.config.addonInstance];
  } catch {
    // Ignore
  }
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
}

async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      break;
    default:
      return;
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
