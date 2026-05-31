import { describe, expect, it } from "vitest";

import type { ScopeContext } from "../types/scope";
import {
  buildReaderActionDraft,
  mergeReaderActionScope,
} from "./readerActionFlow";

describe("buildReaderActionDraft", () => {
  it("builds an auto-send explain prompt from selected text", () => {
    expect(
      buildReaderActionDraft({
        action: "explain",
        text: "This is the highlighted paragraph.",
        page: 7,
      }),
    ).toContain("Explain the following excerpt from page 7");
  });

  it("builds a prefilled ask prompt from selected text", () => {
    expect(
      buildReaderActionDraft({
        action: "ask",
        text: "This is the highlighted paragraph.",
        page: 7,
      }),
    ).toContain("Question:");
  });

  it("adds selected text to the current pdf scope so the sidebar can show it as active context", () => {
    const scope: ScopeContext = {
      type: "pdf",
      id: "pdf-7",
      label: "Current PDF",
      itemIds: [7],
      readerAttachmentId: 77,
    };

    expect(
      mergeReaderActionScope(scope, {
        text: "This is the highlighted paragraph.",
      }),
    ).toEqual({
      ...scope,
      selectedText: "This is the highlighted paragraph.",
    });
  });
});
