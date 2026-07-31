import { describe, expect, it } from "vitest";

import {
  SIDEBAR_COMPACT_BREAKPOINT,
  SIDEBAR_DENSE_BREAKPOINT,
  resolveSidebarLayout,
} from "./sidebarLayout";

describe("sidebar layout breakpoints", () => {
  it("defines dense and compact layouts without forcing a native pane width", () => {
    expect(SIDEBAR_DENSE_BREAKPOINT).toBe(280);
    expect(SIDEBAR_COMPACT_BREAKPOINT).toBe(360);
  });

  it("uses dense, compact, and regular layouts at the responsive breakpoints", () => {
    expect(resolveSidebarLayout(0)).toBe("dense");
    expect(resolveSidebarLayout(279)).toBe("dense");
    expect(resolveSidebarLayout(280)).toBe("compact");
    expect(resolveSidebarLayout(359)).toBe("compact");
    expect(resolveSidebarLayout(360)).toBe("regular");
    expect(resolveSidebarLayout(520)).toBe("regular");
    expect(resolveSidebarLayout(null)).toBe("regular");
  });
});
