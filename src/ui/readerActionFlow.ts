export interface ReaderActionDetail {
  action: "explain" | "ask";
  text: string;
  page: number;
  readerItemID: number;
}

export function buildReaderActionDraft(
  detail: Pick<ReaderActionDetail, "action" | "text" | "page">,
): string {
  const quoted = `"""${detail.text.trim()}"""`;
  if (detail.action === "explain") {
    return `Explain the following excerpt from page ${detail.page} in clear research language:\n\n${quoted}`;
  }

  return `I am reading page ${detail.page}. Based on this excerpt, help me think through it.\n\n${quoted}\n\nQuestion: `;
}
