import type { ScopeContext } from "../types/scope";

export type ContextAvailability =
  | "pdf-text-ready"
  | "abstract-only"
  | "metadata-only"
  | "collection-truncated"
  | "fulltext-required-error"
  | "fulltext-unsupported-scope";

export interface AssembledContext {
  availability: ContextAvailability;
  blockingMessage?: string;
  fullText: string;
  fullTextSource?: string;
  metadata: string;
  selectedText?: string;
  warnings: string[];
}

const FULLTEXT_REQUIRED_MESSAGE =
  "当前论文全文不可用，Zotero 暂时无法读取该 PDF 正文，无法发送请求。请确认 Zotero 已成功提取全文后重试。";
const MULTI_PDF_BLOCKING_MESSAGE =
  "当前论文包含多个 PDF 附件，无法确定唯一全文来源。请只保留一个 PDF 后重试。";
const UNSUPPORTED_SCOPE_MESSAGE =
  "当前仅支持单篇论文或当前 PDF 的全文模式。";

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as {
        Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } };
      }).Zotero?.Prefs?.get?.("intl.accept_languages", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

export async function assembleContext(scope: ScopeContext): Promise<AssembledContext> {
  switch (scope.type) {
    case "pdf":
      return await assemblePDFContext(scope);
    case "paper":
      return await assemblePaperContext(scope);
    case "collection":
    case "manual-selection":
      return createUnsupportedScopeContext(scope);
    default:
      return createEmptyContext();
  }
}

async function assemblePDFContext(scope: ScopeContext): Promise<AssembledContext> {
  if (!scope.readerAttachmentId) {
    return createBlockingContext(
      "fulltext-required-error",
      FULLTEXT_REQUIRED_MESSAGE,
      "",
      scope.selectedText,
    );
  }

  const attachment = Zotero.Items.get(scope.readerAttachmentId);
  if (!attachment) {
    return createBlockingContext(
      "fulltext-required-error",
      FULLTEXT_REQUIRED_MESSAGE,
      "",
      scope.selectedText,
    );
  }

  const item = attachment.parentItem || attachment;
  const extracted = await extractAttachmentText(attachment);
  if (!extracted?.text) {
    return createBlockingContext(
      "fulltext-required-error",
      FULLTEXT_REQUIRED_MESSAGE,
      formatItemMetadata(item),
      scope.selectedText,
    );
  }

  recordContextAssemblyDiagnostic(scope, extracted.text, extracted.source);
  return {
    availability: "pdf-text-ready",
    fullText: extracted.text,
    fullTextSource: extracted.source,
    metadata: formatItemMetadata(item),
    selectedText: scope.selectedText,
    warnings: [],
  };
}

async function assemblePaperContext(scope: ScopeContext): Promise<AssembledContext> {
  if (!scope.itemIds?.length) {
    return createBlockingContext("fulltext-required-error", FULLTEXT_REQUIRED_MESSAGE);
  }

  const item = Zotero.Items.get(scope.itemIds[0]);
  if (!item) {
    return createBlockingContext("fulltext-required-error", FULLTEXT_REQUIRED_MESSAGE);
  }

  const pdfAttachments = resolvePDFAttachments(item);
  if (pdfAttachments.length === 0) {
    return createBlockingContext(
      "fulltext-required-error",
      FULLTEXT_REQUIRED_MESSAGE,
      formatItemMetadata(item),
    );
  }
  if (pdfAttachments.length > 1) {
    return createBlockingContext(
      "fulltext-required-error",
      MULTI_PDF_BLOCKING_MESSAGE,
      formatItemMetadata(item),
    );
  }

  const extracted = await extractAttachmentText(pdfAttachments[0]);
  if (!extracted?.text) {
    return createBlockingContext(
      "fulltext-required-error",
      FULLTEXT_REQUIRED_MESSAGE,
      formatItemMetadata(item),
    );
  }

  recordContextAssemblyDiagnostic(scope, extracted.text, extracted.source);
  return {
    availability: "pdf-text-ready",
    fullText: extracted.text,
    fullTextSource: extracted.source,
    metadata: formatItemMetadata(item),
    warnings: [],
  };
}

function createUnsupportedScopeContext(scope: ScopeContext): AssembledContext {
  return createBlockingContext(
    "fulltext-unsupported-scope",
    UNSUPPORTED_SCOPE_MESSAGE,
    `范围：${scope.label}\n类型：${scope.type}\n条目数：${scope.itemIds.length}`,
    scope.selectedText,
  );
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

  const lines = [`标题：${title}
作者：${creators || "暂无"}
年份：${year || "暂无"}`];
  if (includeAbstract) {
    lines.push(`摘要：${abstract || "暂无"}`);
  }

  return lines.join("\n");
}

interface ExtractedAttachmentText {
  source: "attachment-text" | "pdf-worker" | "zotero-fulltext-cache";
  text: string;
}

async function extractAttachmentText(
  attachment: Zotero.Item,
): Promise<ExtractedAttachmentText | null> {
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
      const text = resolvedAttachmentText.trim();
      logExtractionSource("attachment-text", text);
      return { source: "attachment-text", text };
    }
  } catch {
    // Fall through to worker/fulltext-cache fallback.
  }

  try {
    const workerResult = await (Zotero as any).PDFWorker?.getFullText?.(attachment.id);
    const workerText =
      typeof workerResult === "string" ? workerResult : workerResult?.text;
    if (typeof workerText === "string" && workerText.trim()) {
      const text = workerText.trim();
      logExtractionSource("pdf-worker", text);
      return { source: "pdf-worker", text };
    }
  } catch {
    // Fall through to full-text cache fallback.
  }

  const cachedText = await readZoteroFulltextCache(attachment);
  if (cachedText) {
    logExtractionSource("zotero-fulltext-cache", cachedText);
    return { source: "zotero-fulltext-cache", text: cachedText };
  }

  return null;
}

async function readZoteroFulltextCache(item: Zotero.Item): Promise<string> {
  try {
    const fulltext =
      (
        Zotero as unknown as {
          Fulltext?: { getItemCacheFile?: (item: Zotero.Item) => nsIFile | null };
          FullText?: { getItemCacheFile?: (item: Zotero.Item) => nsIFile | null };
        }
      ).Fulltext ||
      (
        Zotero as unknown as {
          FullText?: { getItemCacheFile?: (item: Zotero.Item) => nsIFile | null };
        }
      ).FullText;
    const cacheFile = fulltext?.getItemCacheFile?.(item);
    if (!cacheFile) return "";
    if (typeof cacheFile.exists === "function" && !cacheFile.exists()) {
      return "";
    }
    return (await readLocalTextFile(cacheFile)).trim();
  } catch {
    return "";
  }
}

function decodeFileContents(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) return new TextDecoder("utf-8").decode(data);
  if (data instanceof ArrayBuffer) {
    return new TextDecoder("utf-8").decode(new Uint8Array(data));
  }
  return "";
}

async function readLocalTextFile(source: string | nsIFile): Promise<string> {
  const zoteroFile = (
    Zotero as unknown as {
      File?: {
        getContentsAsync?: (
          source: string | nsIFile,
          charset?: string,
        ) => Promise<unknown> | unknown;
      };
    }
  ).File;
  if (zoteroFile?.getContentsAsync) {
    const data = await zoteroFile.getContentsAsync(source, "utf-8");
    return decodeFileContents(data);
  }

  return "";
}

function resolvePDFAttachments(item: Zotero.Item): Zotero.Item[] {
  return item
    .getAttachments()
    .map((id: number) => Zotero.Items.get(id))
    .filter((attachment): attachment is Zotero.Item => Boolean(attachment))
    .filter(
      (attachment) => attachment.attachmentContentType === "application/pdf",
    );
}

function getItemAbstract(item: Zotero.Item): string {
  return ((item.getField("abstractNote") as string) || "").trim();
}

function createBlockingContext(
  availability: "fulltext-required-error" | "fulltext-unsupported-scope",
  blockingMessage: string,
  metadata = "",
  selectedText?: string,
): AssembledContext {
  return {
    availability,
    blockingMessage,
    fullText: "",
    metadata,
    selectedText,
    warnings: [],
  };
}

function createEmptyContext(selectedText?: string): AssembledContext {
  return {
    availability: "metadata-only",
    fullText: "",
    metadata: "",
    selectedText,
    warnings: [],
  };
}

function logExtractionSource(source: ExtractedAttachmentText["source"], text: string): void {
  try {
    ztoolkit.log(`Context full text source: ${source}`, { chars: text.length });
  } catch {
    // Logging must remain best-effort.
  }
}

function recordContextAssemblyDiagnostic(
  scope: ScopeContext,
  fullText: string,
  fullTextSource: string,
): void {
  const diagnostics = ((globalThis as any).__aiAssistantDiagnostics ??= {});
  diagnostics.lastContextAssembly = {
    fullTextChars: fullText.length,
    fullTextSource,
    scopeId: scope.id,
    scopeType: scope.type,
    timestamp: new Date().toISOString(),
  };
}
