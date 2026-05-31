import { getPref, setPref } from "../utils/prefs";

type SidebarRefreshHandler = () => void;

const refreshHandlers = new Set<SidebarRefreshHandler>();

export function isSidebarVisible(): boolean {
  const stored = getPref("sidebarVisible");
  if (typeof stored === "boolean") {
    return stored;
  }

  return true;
}

export function setSidebarVisible(nextVisible: boolean): void {
  setPref("sidebarVisible", nextVisible);
  refreshHandlers.forEach((handler) => handler());
}

export function toggleSidebarVisible(): boolean {
  const nextVisible = !isSidebarVisible();
  setSidebarVisible(nextVisible);
  return nextVisible;
}

export function registerSidebarRefreshHandler(
  handler: SidebarRefreshHandler,
): () => void {
  refreshHandlers.add(handler);
  return () => {
    refreshHandlers.delete(handler);
  };
}
