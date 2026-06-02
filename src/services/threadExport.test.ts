import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Thread } from "../types/thread";
import { exportThreadAsMarkdown } from "./threadExport";

function makeThread(): Thread {
  return {
    id: "thread-1",
    title: "Example thread",
    createdAt: new Date("2026-06-02T10:00:00Z").getTime(),
    updatedAt: new Date("2026-06-02T10:05:00Z").getTime(),
    scopeSnapshot: {
      type: "pdf",
      id: "pdf-1",
      label: "A Scientific Human-Agent Reproduction Pipeline",
      itemIds: [4995],
      readerAttachmentId: 4996,
    },
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "What is the core method?",
        timestamp: new Date("2026-06-02T10:01:00Z").getTime(),
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Three key points...",
        timestamp: new Date("2026-06-02T10:02:00Z").getTime(),
      },
    ],
  };
}

describe("threadExport", () => {
  beforeEach(() => {
    vi.stubGlobal("Zotero", {
      File: {
        pathToFile: vi.fn((path: string) => path),
        putContents: vi.fn(),
      },
    });
  });

  it("exports one thread as markdown with scope metadata and ordered messages", async () => {
    await exportThreadAsMarkdown(makeThread(), "/tmp/example-thread.md");

    expect(Zotero.File.putContents).toHaveBeenCalledTimes(1);
    const output = (Zotero.File.putContents as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(String(output)).toContain("# Example thread");
    expect(String(output)).toContain("Scope: pdf");
    expect(String(output)).toContain("A Scientific Human-Agent Reproduction Pipeline");
    expect(String(output)).toContain("## User");
    expect(String(output)).toContain("What is the core method?");
    expect(String(output)).toContain("## Assistant");
    expect(String(output)).toContain("Three key points...");
  });
});
