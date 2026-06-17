import type { ScopeContext } from "../types/scope";

export interface ReaderActionDetail {
  action: "explain" | "ask";
  text: string;
  page: number;
  readerItemID: number;
  traceId?: string;
}

export function buildReaderActionDraft(
  detail: Pick<ReaderActionDetail, "action" | "text" | "page">,
): string {
  const quoted = `"""${detail.text.trim()}"""`;
  if (detail.action === "explain") {
    return `请用清晰的科研语言解释下面这段来自第 ${detail.page} 页的摘录：\n\n${quoted}`;
  }

  return `我正在阅读第 ${detail.page} 页。请基于下面这段摘录帮助我理解并继续思考。\n\n${quoted}\n\n问题：`;
}

export function mergeReaderActionScope(
  scope: ScopeContext | null,
  detail: Pick<ReaderActionDetail, "text" | "page">,
): ScopeContext | null {
  if (!scope) {
    return null;
  }

  const selectedText = detail.text.trim();
  if (!selectedText) {
    return scope;
  }

  return {
    ...scope,
    readerPage: detail.page,
    selectedText,
  };
}
