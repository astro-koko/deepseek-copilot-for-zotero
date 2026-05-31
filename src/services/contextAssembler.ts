import type { ScopeContext, ScopeType } from "../types/scope";

export type ContextAvailability =
  | "pdf-text-ready"
  | "abstract-only"
  | "metadata-only"
  | "collection-truncated";

export interface AssembledContext {
  availability: ContextAvailability;
  metadata: string;
  fullText: string;
  selectedText?: string;
  warnings: string[];
}

const MAX_CONTEXT_CHARS = 12000; // Roughly 4000 tokens
const COLLECTION_FULL_TEXT_ITEM_LIMIT = 3;
const ABSTRACT_FALLBACK_WARNING =
  "Using the abstract because no extractable PDF text is available for this scope.";
const METADATA_ONLY_WARNING = "Only item metadata is available for this scope.";
const COLLECTION_TRUNCATED_WARNING =
  "Collection too large for full text inclusion; using metadata summary only.";

export function assembleContext(scope: ScopeContext): AssembledContext {
  switch (scope.type) {
    case "pdf":
      return assemblePDFContext(scope);
    case "paper":
      return assemblePaperContext(scope);
    case "collection":
      return assembleCollectionContext(scope);
    case "manual-selection":
      return assembleCollectionContext(scope); // Same strategy
    default:
      return createEmptyContext();
  }
}

function assemblePDFContext(scope: ScopeContext): AssembledContext {
  if (!scope.readerAttachmentId) {
    return createEmptyContext(scope.selectedText);
  }

  const attachment = Zotero.Items.get(scope.readerAttachmentId);
  if (!attachment) {
    return createEmptyContext(scope.selectedText);
  }

  const parentItem = attachment.parentItem;
  const item = parentItem || attachment;
  const fullText = extractAttachmentText(attachment);
  if (!fullText) {
    return assembleItemFallbackContext(item, scope.selectedText);
  }

  return {
    availability: "pdf-text-ready",
    metadata: formatItemMetadata(item),
    fullText: truncateContext(fullText),
    selectedText: scope.selectedText,
    warnings: [],
  };
}

function assemblePaperContext(scope: ScopeContext): AssembledContext {
  if (!scope.itemIds?.length) {
    return createEmptyContext();
  }

  const item = Zotero.Items.get(scope.itemIds[0]);
  if (!item) {
    return createEmptyContext();
  }

  const pdfAttachment = resolveFirstPDFAttachment(item);
  const fullText = pdfAttachment ? extractAttachmentText(pdfAttachment) : "";
  if (!fullText) {
    return assembleItemFallbackContext(item);
  }

  return {
    availability: "pdf-text-ready",
    metadata: formatItemMetadata(item),
    fullText: truncateContext(fullText),
    warnings: [],
  };
}

function assembleCollectionContext(scope: ScopeContext): AssembledContext {
  if (!scope.itemIds?.length) {
    return createEmptyContext();
  }

  const items = scope.itemIds
    .map((id) => Zotero.Items.get(id))
    .filter((item): item is Zotero.Item => Boolean(item));

  let metadata = `Collection: ${scope.label}\nItems: ${items.length}\n\n`;

  // Include metadata for all items
  for (const item of items) {
    metadata += formatItemMetadata(item, true) + "\n---\n";
  }

  if (items.length > COLLECTION_FULL_TEXT_ITEM_LIMIT) {
    return {
      availability: "collection-truncated",
      metadata,
      fullText: "",
      warnings: [COLLECTION_TRUNCATED_WARNING],
    };
  }

  const pdfSegments = items
    .map((item) => {
      const pdfAttachment = resolveFirstPDFAttachment(item);
      const text = pdfAttachment ? extractAttachmentText(pdfAttachment) : "";
      if (!text) {
        return "";
      }
      return `\n=== ${item.getDisplayTitle()} ===\n${text.slice(0, 3000)}\n`;
    })
    .filter(Boolean);

  if (pdfSegments.length > 0) {
    const fullText = pdfSegments.join("");
    return {
      availability: "pdf-text-ready",
      metadata,
      fullText: truncateContext(
        fullText,
        Math.max(0, MAX_CONTEXT_CHARS - metadata.length),
      ),
      warnings: [],
    };
  }

  const abstractSegments = items
    .map((item) => {
      const abstract = getItemAbstract(item);
      if (!abstract) {
        return "";
      }
      return `\n=== ${item.getDisplayTitle()} ===\n${abstract}\n`;
    })
    .filter(Boolean);

  if (abstractSegments.length > 0) {
    const fullText = abstractSegments.join("");
    return {
      availability: "abstract-only",
      metadata,
      fullText: truncateContext(
        fullText,
        Math.max(0, MAX_CONTEXT_CHARS - metadata.length),
      ),
      warnings: [ABSTRACT_FALLBACK_WARNING],
    };
  }

  return {
    availability: "metadata-only",
    metadata,
    fullText: "",
    warnings: [METADATA_ONLY_WARNING],
  };
}

function formatItemMetadata(
  item: Zotero.Item,
  compact = false,
  options?: { includeAbstract?: boolean },
): string {
  const title = item.getDisplayTitle();
  const creators = item.getCreators()
    .map((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.trim())
    .join(", ");
  const year = item.getField("date")?.toString().slice(0, 4) || "";
  const abstract = getItemAbstract(item);
  const includeAbstract = options?.includeAbstract ?? true;

  if (compact) {
    return `${title}${creators ? ` — ${creators}` : ""}${year ? ` (${year})` : ""}`;
  }

  const lines = [`Title: ${title}
Authors: ${creators || "N/A"}
Year: ${year || "N/A"}`];
  if (includeAbstract) {
    lines.push(`Abstract: ${abstract || "N/A"}`);
  }

  return lines.join("\n");
}

function extractAttachmentText(attachment: Zotero.Item): string {
  try {
    // Use Zotero's built-in PDF text extraction if available
    const text = (attachment as any).attachmentText;
    if (typeof text === "string" && text.trim()) return text;
  } catch {
    // Fallback
  }
  return "";
}

function truncateContext(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...content truncated...]";
}

function resolveFirstPDFAttachment(item: Zotero.Item): Zotero.Item | null {
  const attachments = item
    .getAttachments()
    .map((id: number) => Zotero.Items.get(id))
    .filter((attachment): attachment is Zotero.Item => Boolean(attachment));

  return (
    attachments.find(
      (attachment) => attachment.attachmentContentType === "application/pdf",
    ) || null
  );
}

function assembleItemFallbackContext(
  item: Zotero.Item,
  selectedText?: string,
): AssembledContext {
  const abstract = getItemAbstract(item);
  if (abstract) {
    return {
      availability: "abstract-only",
      metadata: formatItemMetadata(item, false, { includeAbstract: false }),
      fullText: truncateContext(abstract),
      selectedText,
      warnings: [ABSTRACT_FALLBACK_WARNING],
    };
  }

  return {
    availability: "metadata-only",
    metadata: formatItemMetadata(item, false, { includeAbstract: false }),
    fullText: "",
    selectedText,
    warnings: [METADATA_ONLY_WARNING],
  };
}

function getItemAbstract(item: Zotero.Item): string {
  return ((item.getField("abstractNote") as string) || "").trim();
}

function createEmptyContext(selectedText?: string): AssembledContext {
  return {
    availability: "metadata-only",
    metadata: "",
    fullText: "",
    selectedText,
    warnings: [],
  };
}
