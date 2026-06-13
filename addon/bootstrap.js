/**
 * Bootstrap script for the Deepseek Copliot plugin.
 * Based on Zotero team's Make It Red example and zotero-plugin-toolkit patterns.
 */

var chromeHandle;

function logBootstrapError(stage, error) {
  const message = `[Deepseek Copliot bootstrap] ${stage}: ${error?.message || error}`;
  try {
    Zotero.logError(message);
    if (error?.stack) {
      Zotero.logError(error.stack);
    }
  } catch (_) {}
  try {
    Services.console.logStringMessage(message);
    if (error?.stack) {
      Services.console.logStringMessage(error.stack);
    }
  } catch (_) {}
}

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  try {
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "__addonRef__", rootURI + "content/"],
    ]);

    const ctx = { rootURI };
    ctx._globalThis = ctx;

    Services.scriptloader.loadSubScript(
      `${rootURI}/content/scripts/__addonRef__.js`,
      ctx,
    );

    await Zotero.__addonInstance__.hooks.onStartup();
  } catch (error) {
    logBootstrapError("startup", error);
  }
}

async function onMainWindowLoad({ window }, reason) {
  try {
    await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
  } catch (error) {
    logBootstrapError("onMainWindowLoad", error);
  }
}

async function onMainWindowUnload({ window }, reason) {
  try {
    await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
  } catch (error) {
    logBootstrapError("onMainWindowUnload", error);
  }
}

async function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  try {
    await Zotero.__addonInstance__?.hooks.onShutdown();
  } catch (error) {
    logBootstrapError("shutdown", error);
  }

  try {
    delete Zotero.__addonInstance__;
  } catch (_) {}

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {}
