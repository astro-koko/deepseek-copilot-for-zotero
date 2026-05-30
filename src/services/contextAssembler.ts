import type { ScopeContext, ScopeType } from "../types/scope";

export interface AssembledContext {
  metadata: string;
  fullText: string;
  selectedText?: string;
}

const MAX_CONTEXT_CHARS = 12000; // Roughly 4000 tokens

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
      return { metadata: "", fullText: "" };
  }
}

function assemblePDFContext(scope: ScopeContext): AssembledContext {
  if (!scope.readerAttachmentId) {
    return { metadata: "", fullText: "" };
  }

  const attachment = Zotero.Items.get(scope.readerAttachmentId);
  if (!attachment) {
    return { metadata: "", fullText: "" };
  }

  const parentItem = attachment.parentItem;
  const item = parentItem || attachment;

  const metadata = formatItemMetadata(item);
  const fullText = extractAttachmentText(attachment);

  return {
    metadata,
    fullText: truncateContext(fullText),
    selectedText: scope.selectedText,
  };
}

function assemblePaperContext(scope: ScopeContext): AssembledContext {
  if (!scope.itemIds?.length) {
    return { metadata: "", fullText: "" };
  }

  const item = Zotero.Items.get(scope.itemIds[0]);
  if (!item) {
    return { metadata: "", fullText: "" };
  }

  const metadata = formatItemMetadata(item);

  // Try to get linked attachment text
  let fullText = "";
  const attachments = item.getAttachments().map((id: number) => Zotero.Items.get(id));
  const pdfAttachment = attachments.find((a: Zotero.Item) => a.attachmentContentType === "application/pdf");
  if (pdfAttachment) {
    fullText = extractAttachmentText(pdfAttachment);
  }

  return {
    metadata,
    fullText: truncateContext(fullText),
  };
}

function assembleCollectionContext(scope: ScopeContext): AssembledContext {
  if (!scope.itemIds?.length) {
    return { metadata: "", fullText: "" };
  }

  const items = scope.itemIds
    .map((id) => Zotero.Items.get(id))
    .filter(Boolean);

  let metadata = `Collection: ${scope.label}\nItems: ${items.length}\n\n`;
  let fullText = "";

  // Include metadata for all items
  for (const item of items) {
    metadata += formatItemMetadata(item, true) + "\n---\n";
  }

  // For small collections, include limited full text
  if (items.length <= 3) {
    for (const item of items) {
      const attachments = item.getAttachments().map((id: number) => Zotero.Items.get(id));
      const pdfAttachment = attachments.find((a: Zotero.Item) => a.attachmentContentType === "application/pdf");
      if (pdfAttachment) {
        const text = extractAttachmentText(pdfAttachment);
        fullText += `\n=== ${item.getDisplayTitle()} ===\n${text.slice(0, 3000)}\n`;
      }
    }
  } else {
    fullText = "[Collection too large for full text inclusion. Use specific questions about individual papers.]";
  }

  return {
    metadata,
    fullText: truncateContext(fullText, Math.max(0, MAX_CONTEXT_CHARS - metadata.length)),
  };
}

function formatItemMetadata(item: Zotero.Item, compact = false): string {
  const title = item.getDisplayTitle();
  const creators = item.getCreators()
    .map((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.trim())
    .join(", ");
  const year = item.getField("date")?.toString().slice(0, 4) || "";
  const abstract = item.getField("abstractNote") as string || "";

  if (compact) {
    return `${title}${creators ? ` — ${creators}` : ""}${year ? ` (${year})` : ""}`;
  }

  return `Title: ${title}
Authors: ${creators || "N/A"}
Year: ${year || "N/A"}
Abstract: ${abstract || "N/A"}`;
}

function extractAttachmentText(attachment: Zotero.Item): string {
  try {
    // Use Zotero's built-in PDF text extraction if available
    const text = (attachment as any).attachmentText;
    if (text) return text;
  } catch {
    // Fallback
  }
  return "[PDF text not available]";
}

function truncateContext(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...content truncated...]";
}
