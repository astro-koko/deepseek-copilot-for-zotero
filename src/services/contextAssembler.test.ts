import { beforeEach, describe, expect, it, vi } from "vitest";

import { assembleContext } from "./contextAssembler";
import type { ScopeContext } from "../types/scope";

interface FakeCreator {
  firstName?: string;
  lastName?: string;
}

interface FakeItemShape {
  id: number;
  abstractNote?: string;
  attachmentContentType?: string;
  attachmentText?: string | Promise<string>;
  cacheFileExists?: boolean;
  cacheFilePath?: string;
  creators?: FakeCreator[];
  date?: string;
  displayTitle: string;
  parentItem?: FakeItemShape | null;
  attachmentIDs?: number[];
}

const itemRegistry = new Map<number, FakeItemShape>();

function registerItem(shape: FakeItemShape): FakeItemShape {
  itemRegistry.set(shape.id, shape);
  return shape;
}

function makeItem(shape: FakeItemShape): Zotero.Item {
  return {
    id: shape.id,
    attachmentContentType: shape.attachmentContentType,
    attachmentText: shape.attachmentText,
    parentItem: shape.parentItem ? makeItem(shape.parentItem) : null,
    getAttachments: () => shape.attachmentIDs || [],
    getCreators: () => shape.creators || [],
    getDisplayTitle: () => shape.displayTitle,
    getField: (field: string) => {
      if (field === "abstractNote") return shape.abstractNote || "";
      if (field === "date") return shape.date || "";
      return "";
    },
  } as unknown as Zotero.Item;
}

function makeScope(overrides: Partial<ScopeContext>): ScopeContext {
  return {
    type: "paper",
    id: "paper-1",
    label: "Paper 1",
    itemIds: [1],
    ...overrides,
  };
}

beforeEach(() => {
  itemRegistry.clear();
  vi.stubGlobal("Zotero", {
    File: {
      getContentsAsync: vi.fn(async () => ""),
    },
    FullText: {
      getItemCacheFile: vi.fn((item: { id: number }) => {
        const entry = itemRegistry.get(item.id);
        if (!entry?.cacheFilePath) return null;
        return {
          path: entry.cacheFilePath,
          exists: () => entry.cacheFileExists ?? true,
        };
      }),
    },
    Items: {
      get: (id: number) => {
        const item = itemRegistry.get(id);
        return item ? makeItem(item) : null;
      },
    },
    PDFWorker: {
      getFullText: vi.fn(async () => ({ text: "" })),
    },
  });
});

describe("assembleContext", () => {
  it("marks reader context as pdf-text-ready when attachment text is available", async () => {
    const parent = registerItem({
      id: 10,
      abstractNote: "Parent abstract",
      creators: [{ firstName: "Ada", lastName: "Lovelace" }],
      date: "2025-05-01",
      displayTitle: "Reader Paper",
    });
    registerItem({
      id: 11,
      attachmentContentType: "application/pdf",
      attachmentText: "Full PDF text",
      displayTitle: "Reader PDF",
      parentItem: parent,
    });

    const result = await assembleContext(
      makeScope({
        type: "pdf",
        id: "pdf-11",
        itemIds: [10],
        readerAttachmentId: 11,
      }),
    );

    expect(result.availability).toBe("pdf-text-ready");
    expect(result.warnings).toEqual([]);
    expect(result.fullText).toContain("Full PDF text");
  });

  it("awaits promised attachment text before falling back to the abstract", async () => {
    const parent = registerItem({
      id: 20,
      abstractNote: "Parent abstract",
      displayTitle: "Async Reader Paper",
    });
    registerItem({
      id: 21,
      attachmentContentType: "application/pdf",
      attachmentText: Promise.resolve("Promised PDF text"),
      displayTitle: "Async Reader PDF",
      parentItem: parent,
    });

    const result = await assembleContext(
      makeScope({
        type: "pdf",
        id: "pdf-21",
        itemIds: [20],
        readerAttachmentId: 21,
      }),
    );

    expect(result.availability).toBe("pdf-text-ready");
    expect(result.fullText).toContain("Promised PDF text");
  });

  it("uses PDFWorker full text when the attachment item has no inline text cache", async () => {
    const parent = registerItem({
      id: 30,
      abstractNote: "Parent abstract",
      displayTitle: "Worker Reader Paper",
    });
    registerItem({
      id: 31,
      attachmentContentType: "application/pdf",
      displayTitle: "Worker Reader PDF",
      parentItem: parent,
    });
    (Zotero.PDFWorker.getFullText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: "Worker extracted PDF text",
    });

    const result = await assembleContext(
      makeScope({
        type: "pdf",
        id: "pdf-31",
        itemIds: [30],
        readerAttachmentId: 31,
      }),
    );

    expect(result.availability).toBe("pdf-text-ready");
    expect(result.fullText).toContain("Worker extracted PDF text");
  });

  it("returns the full PDF text even when the active reader page is later in the document", async () => {
    const parent = registerItem({
      id: 40,
      abstractNote: "Parent abstract",
      displayTitle: "Paged Reader Paper",
    });
    registerItem({
      id: 41,
      attachmentContentType: "application/pdf",
      displayTitle: "Paged Reader PDF",
      parentItem: parent,
    });
    const filler = "Introduction text. ".repeat(1200);
    const pageFiveSegment =
      "Page 5\nCode Availability\nThe SHARP template is available at https://github.com/stanford-ai4physics/sharp.";
    (Zotero.PDFWorker.getFullText as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: `${filler}\n${pageFiveSegment}\n`,
    });

    const result = await assembleContext(
      makeScope({
        type: "pdf",
        id: "pdf-41",
        itemIds: [40],
        readerAttachmentId: 41,
        readerPage: 5,
      }),
    );

    expect(result.availability).toBe("pdf-text-ready");
    expect(result.fullText).toContain("Introduction text.");
    expect(result.fullText).toContain("Code Availability");
    expect(result.fullText).toContain("stanford-ai4physics/sharp");
    expect(result.fullText).not.toContain("[...content truncated...]");
  });

  it("reads the Zotero full-text cache when PDFWorker returns no text", async () => {
    registerItem({
      id: 1,
      attachmentIDs: [2],
      creators: [{ firstName: "Grace", lastName: "Hopper" }],
      date: "2024-02-20",
      displayTitle: "Cached Paper",
    });
    registerItem({
      id: 2,
      attachmentContentType: "application/pdf",
      cacheFileExists: true,
      cacheFilePath: "/tmp/zotero/storage/ABCD1234/.zotero-ft-cache",
      displayTitle: "Cached PDF",
    });
    (Zotero.File.getContentsAsync as ReturnType<typeof vi.fn>).mockResolvedValue(
      "This indexed Zotero text should be used when PDFWorker is empty.",
    );

    const result = await assembleContext(makeScope({}));

    expect(result.availability).toBe("pdf-text-ready");
    expect(result.fullText).toContain(
      "This indexed Zotero text should be used when PDFWorker is empty.",
    );
  });

  it("blocks single-paper mode when no PDF attachment is available", async () => {
    registerItem({
      id: 1,
      abstractNote: "Abstract fallback content",
      attachmentIDs: [],
      creators: [{ firstName: "Grace", lastName: "Hopper" }],
      date: "2024-02-20",
      displayTitle: "Abstract Only Paper",
    });

    const result = await assembleContext(makeScope({}));

    expect(result.availability).toBe("fulltext-required-error");
    expect(result.blockingMessage).toContain("全文");
  });

  it("blocks single-paper mode when multiple PDF attachments are present", async () => {
    registerItem({
      id: 1,
      attachmentIDs: [2, 3],
      displayTitle: "Multi PDF Paper",
    });
    registerItem({
      id: 2,
      attachmentContentType: "application/pdf",
      displayTitle: "Main PDF",
    });
    registerItem({
      id: 3,
      attachmentContentType: "application/pdf",
      displayTitle: "Supplement PDF",
    });

    const result = await assembleContext(makeScope({}));

    expect(result.availability).toBe("fulltext-required-error");
    expect(result.blockingMessage).toContain("多个 PDF");
  });

  it("blocks single-pdf mode when no extractable full text is available", async () => {
    const parent = registerItem({
      id: 50,
      abstractNote: "Parent abstract",
      displayTitle: "Reader Paper",
    });
    registerItem({
      id: 51,
      attachmentContentType: "application/pdf",
      displayTitle: "Reader PDF",
      parentItem: parent,
    });

    const result = await assembleContext(
      makeScope({
        type: "pdf",
        id: "pdf-51",
        itemIds: [50],
        readerAttachmentId: 51,
      }),
    );

    expect(result.availability).toBe("fulltext-required-error");
    expect(result.blockingMessage).toContain("无法读取");
  });

  it("marks collection scope as unsupported for full-text mode", async () => {
    registerItem({
      id: 1,
      displayTitle: "Paper 1",
    });

    const result = await assembleContext(
      makeScope({
        type: "collection",
        id: "collection-1",
        label: "Large Collection",
        itemIds: [1],
      }),
    );

    expect(result.availability).toBe("fulltext-unsupported-scope");
    expect(result.fullText).toBe("");
    expect(result.blockingMessage).toContain("仅支持单篇论文或当前 PDF");
  });

  it("marks manual selection scope as unsupported for full-text mode", async () => {
    registerItem({
      id: 1,
      displayTitle: "Paper 1",
    });

    const result = await assembleContext(
      makeScope({
        type: "manual-selection",
        id: "selection-1",
        label: "Picked Papers",
        itemIds: [1],
      }),
    );

    expect(result.availability).toBe("fulltext-unsupported-scope");
    expect(result.blockingMessage).toContain("仅支持单篇论文或当前 PDF");
  });
});
