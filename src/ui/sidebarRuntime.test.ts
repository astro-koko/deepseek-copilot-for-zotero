import { beforeEach, describe, expect, it, vi } from "vitest";

const prefState = new Map<string, unknown>();

const prefMocks = vi.hoisted(() => {
  const getPref = vi.fn((key: string) => prefState.get(key));
  const setPref = vi.fn((key: string, value: unknown) => {
    prefState.set(key, value);
  });

  return { getPref, setPref };
});

vi.mock("../utils/prefs", () => ({
  getPref: prefMocks.getPref,
  setPref: prefMocks.setPref,
}));

import {
  isSidebarVisible,
  registerSidebarRefreshHandler,
  setSidebarVisible,
  toggleSidebarVisible,
} from "./sidebarRuntime";

describe("sidebarRuntime", () => {
  beforeEach(() => {
    prefState.clear();
    prefMocks.getPref.mockImplementation((key: string) => prefState.get(key));
    prefMocks.setPref.mockImplementation((key: string, value: unknown) => {
      prefState.set(key, value);
    });
  });

  it("defaults to visible when no pref is stored", () => {
    expect(isSidebarVisible()).toBe(true);
  });

  it("persists visibility changes and refreshes registered windows", () => {
    const refresh = vi.fn();
    const unregister = registerSidebarRefreshHandler(refresh);

    setSidebarVisible(false);
    expect(prefMocks.setPref).toHaveBeenCalledWith("sidebarVisible", false);
    expect(refresh).toHaveBeenCalledTimes(1);

    unregister();
    setSidebarVisible(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("toggles the stored sidebar visibility state", () => {
    prefState.set("sidebarVisible", false);

    toggleSidebarVisible();

    expect(prefMocks.setPref).toHaveBeenCalledWith("sidebarVisible", true);
  });
});
