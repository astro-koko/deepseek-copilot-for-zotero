import { initLocale } from "./utils/locale";
import { config, version } from "../package.json";
import { createZToolkit } from "./utils/ztoolkit";
import { UIFactory } from "./ui/ui";
import { initReaderIntegration, cleanupReaderIntegration } from "./modules/readerIntegration";
import { initDatabase, closeDatabase } from "./services/persistence";
import { registerScopeNotifier, unregisterScopeNotifier } from "./services/scopeResolver";
import { chatSessionStore } from "./services/chatSession";
import { EventBus } from "./utils/eventBus";
import { createRefCountedRegistration, createWindowEventDispatcher } from "./utils/windowLifecycle";
import { buildStartupDiagnostic } from "./utils/startupDiagnostics";
import { registerPreferencesPane } from "./modules/preferencesPane";

let scopeChangeCallback: ((scope: any) => void) | null = null;
const scopeChangeDispatcher = createWindowEventDispatcher<
  Window & { __aiAssistantEventBus?: EventTarget },
  unknown
>("scopeChange");
const stylesheetRegistration = createRefCountedRegistration(
  loadStylesheet,
  unloadStylesheet,
);

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  ztoolkit.log(
    buildStartupDiagnostic({
      addonID: config.addonID,
      stage: "startup",
      version,
    }),
  );

  // Initialize database
  try {
    await initDatabase();
    ztoolkit.log("Database initialized");
  } catch (e) {
    ztoolkit.log("Database init failed:", e);
  }

  // Register reader integration
  try {
    initReaderIntegration();
    ztoolkit.log("Reader integration initialized");
  } catch (e) {
    ztoolkit.log("Reader integration init failed:", e);
  }

  // Register preferences pane
  try {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
      id: `${addon.data.config.addonRef}-prefpane`,
      label: "DS Copilot",
      image: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
    });
    ztoolkit.log("Preferences pane registered");
  } catch (e) {
    ztoolkit.log("Preferences pane registration failed:", e);
  }

  // Load UI for all windows
  const mainWindows = Zotero.getMainWindows();
  if (mainWindows.length > 0) {
    const results = await Promise.allSettled(mainWindows.map((win) => onMainWindowLoad(win)));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        ztoolkit.log(`Window bootstrap failed for index ${index}:`, result.reason);
      }
    });
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
  ztoolkit.log(
    buildStartupDiagnostic({
      addonID: config.addonID,
      stage: "main-window-load",
      version,
    }),
  );

  win.MozXULElement?.insertFTLIfNeeded?.(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  // Setup event bus on window
  (win as any).__aiAssistantEventBus = EventBus.getInstance();
  scopeChangeDispatcher.addWindow(win as Window & { __aiAssistantEventBus?: EventTarget });

  stylesheetRegistration.acquire();

  try {
    UIFactory.registerChatPanel(win as Window & { __aiAssistantEventBus?: EventTarget });
    ztoolkit.log(
      buildStartupDiagnostic({
        addonID: config.addonID,
        stage: "sidebar-registered",
        version,
      }),
    );
  } catch (error) {
    ztoolkit.log(
      buildStartupDiagnostic({
        addonID: config.addonID,
        version,
        stage: "sidebar-registration-failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  if (!scopeChangeCallback) {
    scopeChangeCallback = (scope) => {
      scopeChangeDispatcher.dispatch(scope);
      UIFactory.refreshAllWindows();
    };

    try {
      registerScopeNotifier(scopeChangeCallback);
      ztoolkit.log("Scope notifier registered");
    } catch (e) {
      ztoolkit.log("Scope notifier registration failed:", e);
    }
  }

  UIFactory.refreshWindow(win as Window & { __aiAssistantEventBus?: EventTarget });
  ztoolkit.log(
    buildStartupDiagnostic({
      addonID: config.addonID,
      stage: "ui-ready",
      version,
    }),
  );
}

async function onMainWindowUnload(win: Window): Promise<void> {
  scopeChangeDispatcher.removeWindow(win as Window & { __aiAssistantEventBus?: EventTarget });

  try {
    UIFactory.removeChatPanel(win as Window & { __aiAssistantEventBus?: EventTarget });
  } catch (e) {
    ztoolkit.log("Sidebar removal failed for window:", e);
  }

  stylesheetRegistration.release();
  addon.data.dialog?.window?.close();
}

async function onShutdown(): Promise<void> {
  unregisterScopeNotifier();
  scopeChangeCallback = null;
  scopeChangeDispatcher.clear();
  chatSessionStore.reset();

  try {
    cleanupReaderIntegration();
  } catch (e) {
    ztoolkit.log("Reader integration cleanup failed:", e);
  }

  try {
    await closeDatabase();
  } catch (e) {
    ztoolkit.log("Database close error:", e);
  }

  stylesheetRegistration.reset();
  UIFactory.shutdown();
  EventBus.dispose();
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
      if (data.window) {
        registerPreferencesPane(data.window as Window);
      }
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
