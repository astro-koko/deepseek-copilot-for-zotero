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
const PDF_PAGE_WINDOW = 1;
const COLLECTION_FULL_TEXT_ITEM_LIMIT = 3;
const ABSTRACT_FALLBACK_WARNING =
  "Using the abstract because no extractable PDF text is available for this scope.";
const METADATA_ONLY_WARNING = "Only item metadata is available for this scope.";
const COLLECTION_TRUNCATED_WARNING =
  "Collection too large for full text inclusion; using metadata summary only.";

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as { Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } } }).Zotero?.Prefs?.get?.("intl.accept_languages", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

function localizeWarning(message: string): string {
  if (!isChineseLocale()) {
    return message;
  }

  switch (message) {
    case ABSTRACT_FALLBACK_WARNING:
      return "当前范围没有可提取的 PDF 正文，已自动回退到摘要内容。";
    case METADATA_ONLY_WARNING:
      return "当前范围仅提供条目元数据。";
    case COLLECTION_TRUNCATED_WARNING:
      return "分类过大，无法包含全部正文内容，当前仅使用元数据摘要。";
    default:
      return message;
  }
}

export async function assembleContext(scope: ScopeContext): Promise<AssembledContext> {
  switch (scope.type) {
    case "pdf":
      return await assemblePDFContext(scope);
    case "paper":
      return await assemblePaperContext(scope);
    case "collection":
      return await assembleCollectionContext(scope);
    case "manual-selection":
      return await assembleCollectionContext(scope); // Same strategy
    default:
      return createEmptyContext();
  }
}

async function assemblePDFContext(scope: ScopeContext): Promise<AssembledContext> {
  if (!scope.readerAttachmentId) {
    return createEmptyContext(scope.selectedText);
  }

  const attachment = Zotero.Items.get(scope.readerAttachmentId);
  if (!attachment) {
    return createEmptyContext(scope.selectedText);
  }

  const parentItem = attachment.parentItem;
  const item = parentItem || attachment;
  const fullText = await extractAttachmentText(attachment);
  if (!fullText) {
    return assembleItemFallbackContext(item, scope.selectedText);
  }

  return {
    availability: "pdf-text-ready",
    metadata: formatItemMetadata(item),
    fullText: selectRelevantPDFContext(fullText, scope),
    selectedText: scope.selectedText,
    warnings: [],
  };
}

async function assemblePaperContext(scope: ScopeContext): Promise<AssembledContext> {
  if (!scope.itemIds?.length) {
    return createEmptyContext();
  }

  const item = Zotero.Items.get(scope.itemIds[0]);
  if (!item) {
    return createEmptyContext();
  }

  const pdfAttachment = resolveFirstPDFAttachment(item);
  const fullText = pdfAttachment ? await extractAttachmentText(pdfAttachment) : "";
  if (!fullText) {
    return assembleItemFallbackContext(item);
  }

  return {
    availability: "pdf-text-ready",
    metadata: formatItemMetadata(item),
    fullText: selectRelevantPDFContext(fullText, scope),
    warnings: [],
  };
}

async function assembleCollectionContext(scope: ScopeContext): Promise<AssembledContext> {
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
      warnings: [localizeWarning(COLLECTION_TRUNCATED_WARNING)],
    };
  }

  const pdfSegments = (
    await Promise.all(
      items.map(async (item) => {
        const pdfAttachment = resolveFirstPDFAttachment(item);
        const text = pdfAttachment ? await extractAttachmentText(pdfAttachment) : "";
        if (!text) {
          return "";
        }
        return `\n=== ${item.getDisplayTitle()} ===\n${text.slice(0, 3000)}\n`;
      }),
    )
  ).filter(Boolean);

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
      warnings: [localizeWarning(ABSTRACT_FALLBACK_WARNING)],
    };
  }

  return {
    availability: "metadata-only",
    metadata,
    fullText: "",
    warnings: [localizeWarning(METADATA_ONLY_WARNING)],
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

async function extractAttachmentText(attachment: Zotero.Item): Promise<string> {
  try {
    const attachmentText = (attachment as any).attachmentText;
    const resolvedAttachmentText =
      typeof attachmentText?.then === "function"
        ? await attachmentText
        : attachmentText;
    if (
      typeof resolvedAttachmentText === "string" &&
      resolvedAttachmentText.trim()
    ) {
      return resolvedAttachmentText;
    }
  } catch {
    // Fall through to worker/fulltext fallback.
  }

  try {
    const workerResult = await (Zotero as any).PDFWorker?.getFullText?.(attachment.id);
    const workerText =
      typeof workerResult === "string" ? workerResult : workerResult?.text;
    if (typeof workerText === "string" && workerText.trim()) {
      return workerText;
    }
  } catch {
    // Fall through to empty string.
  }

  return "";
}

function truncateContext(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...content truncated...]";
}

function selectRelevantPDFContext(
  fullText: string,
  scope: Pick<ScopeContext, "readerPage" | "selectedText">,
): string {
  const pageAnchored = scope.readerPage
    ? extractWindowAroundPage(fullText, scope.readerPage, PDF_PAGE_WINDOW)
    : "";
  if (pageAnchored) {
    return truncateContext(pageAnchored);
  }

  const selectedAnchored = scope.selectedText
    ? extractWindowAroundSelection(fullText, scope.selectedText)
    : "";
  if (selectedAnchored) {
    return truncateContext(selectedAnchored);
  }

  return truncateContext(fullText);
}

function extractWindowAroundPage(
  fullText: string,
  page: number,
  windowRadius: number,
): string {
  const pageMarkers = Array.from(
    fullText.matchAll(/(?:^|\n)(?:Page[:\s]+|page\s+)(\d+)(?:\s|\n|$)/g),
  );
  if (pageMarkers.length === 0) {
    return "";
  }

  const pageBoundaries = pageMarkers
    .map((match) => ({
      index: match.index ?? 0,
      page: Number(match[1]),
    }))
    .filter((entry) => Number.isFinite(entry.page));

  const firstMatch = pageBoundaries.find(
    (entry) => entry.page >= page - windowRadius,
  );
  if (!firstMatch) {
    return "";
  }

  const lastMatch =
    [...pageBoundaries]
      .reverse()
      .find((entry) => entry.page <= page + windowRadius) ?? firstMatch;

  const start = firstMatch.index;
  const endCandidate = pageBoundaries.find((entry) => entry.page > lastMatch.page);
  const end = endCandidate ? endCandidate.index : fullText.length;

  return fullText.slice(start, end).trim();
}

function extractWindowAroundSelection(fullText: string, selectedText: string): string {
  const normalizedSelection = selectedText.trim();
  if (!normalizedSelection) {
    return "";
  }

  const index = fullText.indexOf(normalizedSelection);
  if (index < 0) {
    return "";
  }

  const radius = Math.max(1500, normalizedSelection.length * 3);
  const start = Math.max(0, index - radius);
  const end = Math.min(fullText.length, index + normalizedSelection.length + radius);
  return fullText.slice(start, end).trim();
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
      warnings: [localizeWarning(ABSTRACT_FALLBACK_WARNING)],
    };
  }

  return {
    availability: "metadata-only",
    metadata: formatItemMetadata(item, false, { includeAbstract: false }),
    fullText: "",
    selectedText,
    warnings: [localizeWarning(METADATA_ONLY_WARNING)],
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
