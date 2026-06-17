import { describe, expect, it, vi } from "vitest";

vi.mock("zotero-plugin-toolkit", () => ({
  ZoteroToolkit: class {},
}));

import { configureZToolkitForEnv } from "./ztoolkit";

function createFakeToolkit() {
  return {
    UI: {
      basicOptions: {
        ui: {
          enableElementDOMLog: false,
          enableElementJSONLog: false,
        },
      },
    },
    basicOptions: {
      api: {
        pluginID: "",
      },
      debug: {
        disableDebugBridgePassword: false,
      },
      log: {
        disableConsole: true,
        prefix: "",
      },
    },
  };
}

describe("configureZToolkitForEnv", () => {
  it("disables debug bridge password prompts in development", () => {
    const toolkit = createFakeToolkit();

    configureZToolkitForEnv(toolkit as never, "development");

    expect(toolkit.basicOptions.debug.disableDebugBridgePassword).toBe(true);
    expect(toolkit.UI.basicOptions.ui.enableElementJSONLog).toBe(true);
    expect(toolkit.UI.basicOptions.ui.enableElementDOMLog).toBe(true);
  });

  it("keeps debug bridge password prompts enabled in production", () => {
    const toolkit = createFakeToolkit();

    configureZToolkitForEnv(toolkit as never, "production");

    expect(toolkit.basicOptions.debug.disableDebugBridgePassword).toBe(false);
    expect(toolkit.UI.basicOptions.ui.enableElementJSONLog).toBe(false);
    expect(toolkit.UI.basicOptions.ui.enableElementDOMLog).toBe(false);
  });
});
