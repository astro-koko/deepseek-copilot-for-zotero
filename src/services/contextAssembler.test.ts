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
  attachmentText?: string;
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
    Items: {
      get: (id: number) => {
        const item = itemRegistry.get(id);
        return item ? makeItem(item) : null;
      },
    },
  });
});

describe("assembleContext", () => {
  it("marks reader context as pdf-text-ready when attachment text is available", () => {
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

    const result = assembleContext(
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

  it("falls back to the abstract when a paper has no extractable PDF text", () => {
    registerItem({
      id: 1,
      abstractNote: "Abstract fallback content",
      attachmentIDs: [],
      creators: [{ firstName: "Grace", lastName: "Hopper" }],
      date: "2024-02-20",
      displayTitle: "Abstract Only Paper",
    });

    const result = assembleContext(makeScope({}));

    expect(result.availability).toBe("abstract-only");
    expect(result.fullText).toContain("Abstract fallback content");
    expect(result.warnings).toContain(
      "Using the abstract because no extractable PDF text is available for this scope.",
    );
  });

  it("reports collection truncation for large collections instead of pretending full text is available", () => {
    for (let index = 1; index <= 4; index += 1) {
      registerItem({
        id: index,
        abstractNote: `Abstract ${index}`,
        attachmentIDs: [],
        displayTitle: `Paper ${index}`,
      });
    }

    const result = assembleContext(
      makeScope({
        type: "collection",
        id: "collection-1",
        label: "Large Collection",
        itemIds: [1, 2, 3, 4],
      }),
    );

    expect(result.availability).toBe("collection-truncated");
    expect(result.fullText).toBe("");
    expect(result.warnings).toContain(
      "Collection too large for full text inclusion; using metadata summary only.",
    );
  });
});
