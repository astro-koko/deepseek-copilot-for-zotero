import { describe, expect, it } from "vitest";

import {
  extractReaderAttachmentIDFromTabData,
  findReaderTabByID,
  getReaderCurrentPage,
  getReaderSelectedText,
} from "./readerPrivate";

describe("readerPrivate", () => {
  it("reads selected text from private reader selection ranges", () => {
    expect(
      getReaderSelectedText({
        _internalReader: {
          _primaryView: {
            _selectionRanges: [{ text: "First chunk" }, { text: "Second chunk" }],
          },
        },
      }),
    ).toBe("First chunk\n\nSecond chunk");
  });

  it("reads current page from the embedded PDF viewer", () => {
    expect(
      getReaderCurrentPage({
        _internalReader: {
          _primaryView: {
            _iframeWindow: {
              PDFViewerApplication: {
                pdfViewer: {
                  currentPageNumber: 7,
                },
              },
            },
          },
        },
      }),
    ).toBe(7);
  });

  it("extracts attachment id from direct tab data fields", () => {
    expect(extractReaderAttachmentIDFromTabData({ itemID: 88 })).toBe(88);
    expect(extractReaderAttachmentIDFromTabData({ attachmentId: "99" })).toBe(99);
  });

  it("extracts attachment id from nested tab data fields", () => {
    expect(
      extractReaderAttachmentIDFromTabData({
        meta: {
          id: "123",
        },
      }),
    ).toBe(123);
  });

  it("finds a reader tab by the selected tab id", () => {
    expect(
      findReaderTabByID(
        [
          { id: "reader-a", data: { itemID: 1 } },
          { id: "reader-b", data: { itemID: 2 } },
        ],
        "reader-b",
      ),
    ).toEqual({
      id: "reader-b",
      data: { itemID: 2 },
    });
  });
});
