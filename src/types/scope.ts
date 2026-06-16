export type ScopeType = "pdf" | "paper" | "collection" | "manual-selection";

export interface ScopeContext {
  type: ScopeType;
  id: string;
  scopeKey?: string;
  label: string;
  itemIds: number[];
  readerAttachmentId?: number;
  readerPage?: number;
  selectedText?: string;
}
