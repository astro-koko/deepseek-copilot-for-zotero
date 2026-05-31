import { toggleSidebarVisible } from "./sidebarRuntime";

export function triggerToggleChat(_win: Window): void {
  toggleSidebarVisible();
}
