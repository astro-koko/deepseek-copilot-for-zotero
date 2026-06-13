import hooksSource from "../hooks.ts?raw";
import sidebarSource from "./components/Sidebar.tsx?raw";
import uiSource from "./ui.ts?raw";

import { describe, expect, it } from "vitest";

describe("Deepseek Copliot icon surface contract", () => {
  it("keeps plugin-owned host entry points on DeepSeek branded icons", () => {
    expect(uiSource).toContain("content/icons/icon-20.png");
    expect(uiSource).not.toContain("chrome://zotero/skin/20/universal/note.svg");
    expect(uiSource).not.toContain("content/icons/icon-20.svg");
    expect(hooksSource).toContain("content/icons/icon-20.png");
    expect(hooksSource).not.toContain(
      "chrome://zotero/skin/20/universal/note.svg",
    );
    expect(hooksSource).not.toContain("content/icons/icon-20.svg");
  });

  it("uses the DeepSeek favicon inside the sidebar header", () => {
    expect(sidebarSource).toContain("deepseek-favicon.png");
    expect(sidebarSource).not.toContain("content/icons/icon-16.svg");
  });
});
