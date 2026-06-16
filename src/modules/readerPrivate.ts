type SelectionRangeLike = {
  text?: unknown;
};

type PDFViewerLike = {
  currentPageNumber?: unknown;
};

type ReaderPrimaryViewLike = {
  _iframeWindow?: {
    PDFViewerApplication?: {
      pdfViewer?: PDFViewerLike;
    };
  };
  _selectionRanges?: SelectionRangeLike[];
};

type ReaderPrivateLike = {
  _internalReader?: {
    _primaryView?: ReaderPrimaryViewLike;
  };
};

type ReaderTabLike = {
  data?: unknown;
  id?: string | number;
};

function getReaderPrimaryView(reader: unknown): ReaderPrimaryViewLike | null {
  if (!reader || typeof reader !== "object") {
    return null;
  }

  const internalReader = (reader as ReaderPrivateLike)._internalReader;
  if (!internalReader || typeof internalReader !== "object") {
    return null;
  }

  const primaryView = internalReader._primaryView;
  if (!primaryView || typeof primaryView !== "object") {
    return null;
  }

  return primaryView;
}

function toNumericID(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function getReaderSelectedText(reader: unknown): string | null {
  const primaryView = getReaderPrimaryView(reader);
  if (!primaryView?._selectionRanges?.length) {
    return null;
  }

  const selectedText = primaryView._selectionRanges
    .map((range) => (typeof range?.text === "string" ? range.text : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return selectedText || null;
}

export function getReaderCurrentPage(reader: unknown): number | undefined {
  const pdfViewer = getReaderPrimaryView(reader)?._iframeWindow?.PDFViewerApplication?.pdfViewer;
  const pageNumber = pdfViewer?.currentPageNumber;
  if (typeof pageNumber === "number" && Number.isFinite(pageNumber) && pageNumber > 0) {
    return pageNumber;
  }

  return undefined;
}

export function extractReaderAttachmentIDFromTabData(data: unknown): number | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const source = data as Record<string, unknown>;
  const directCandidate = toNumericID(
    source.itemID ??
      source.itemId ??
      source.attachmentID ??
      source.attachmentId ??
      source.id,
  );
  if (directCandidate) {
    return directCandidate;
  }

  for (const value of Object.values(source)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const nested = value as Record<string, unknown>;
    const nestedCandidate = toNumericID(
      nested.itemID ??
        nested.itemId ??
        nested.attachmentID ??
        nested.attachmentId ??
        nested.id,
    );
    if (nestedCandidate) {
      return nestedCandidate;
    }
  }

  return null;
}

export function findReaderTabByID(
  tabs: unknown,
  selectedTabID: string,
): ReaderTabLike | null {
  if (!Array.isArray(tabs) || !selectedTabID) {
    return null;
  }

  return (
    tabs.find((tab) => `${(tab as ReaderTabLike | null)?.id ?? ""}` === selectedTabID) ?? null
  );
}
