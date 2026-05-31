import { describe, expect, it } from "vitest";

import { buildReaderActionDraft } from "./readerActionFlow";

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
});
