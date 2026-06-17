import { ZoteroToolkit } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { configureZToolkitForEnv, createZToolkit };

function createZToolkit() {
  const _ztoolkit = new ZoteroToolkit();
  configureZToolkitForEnv(_ztoolkit, __env__);
  return _ztoolkit;
}

function configureZToolkitForEnv(
  _ztoolkit: ReturnType<typeof createZToolkit>,
  env: "development" | "production",
) {
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = false;
  _ztoolkit.basicOptions.debug.disableDebugBridgePassword =
    env === "development";
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = env === "development";
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = env === "development";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
}
