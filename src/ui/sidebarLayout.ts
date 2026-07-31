export const SIDEBAR_DENSE_BREAKPOINT = 280;
export const SIDEBAR_COMPACT_BREAKPOINT = 360;

export type SidebarLayout = "dense" | "compact" | "regular";

export function resolveSidebarLayout(width: number | null): SidebarLayout {
  if (
    typeof width === "number" &&
    Number.isFinite(width) &&
    width < SIDEBAR_DENSE_BREAKPOINT
  ) {
    return "dense";
  }

  if (
    typeof width === "number" &&
    Number.isFinite(width) &&
    width < SIDEBAR_COMPACT_BREAKPOINT
  ) {
    return "compact";
  }

  return "regular";
}
