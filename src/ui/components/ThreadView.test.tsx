import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { Thread } from "../../types/thread";
import { ThreadView, openMarkdownLink } from "./ThreadView";

function makeThread(messages: Thread["messages"]): Thread {
  return {
    id: "thread-1",
    title: "Markdown thread",
    createdAt: 1,
    updatedAt: 1,
    messages,
  };
}

describe("ThreadView markdown rendering", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders markdown syntax for all visible chat roles", () => {
    vi.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("10:02:03 AM");

    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        hasScope: true,
        thread: makeThread([
          {
            id: "msg-user",
            role: "user",
            content: "**bold** and *italic* with `code`\nnext line",
            timestamp: 1,
          },
          {
            id: "msg-assistant",
            role: "assistant",
            content: [
              "```ts",
              "const answer = 42;",
              "```",
              "",
              "> quote",
              "",
              "- item one",
              "- item two",
              "",
              "| A | B |",
              "| - | - |",
              "| 1 | 2 |",
            ].join("\n"),
            timestamp: 2,
          },
          {
            id: "msg-system",
            role: "system",
            content: "Review [AgentPaper](https://agentpaper.ai)",
            timestamp: 3,
          },
        ]),
      }),
    );

    expect(markup).toContain("<strong>bold</strong>");
    expect(markup).toContain("<em>italic</em>");
    expect(markup).toContain("<code>code</code>");
    expect(markup).toContain("<br/>");
    expect(markup).toContain('<pre style=');
    expect(markup).toContain("const answer = 42;");
    expect(markup).toContain("<blockquote");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<table");
    expect(markup).toContain('href="https://agentpaper.ai"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
    expect(markup.match(/10:02:03 AM/g)?.length).toBe(3);
  });

  it("escapes raw html instead of mounting it as live markup", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: '<span class="unsafe">unsafe</span>',
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("&lt;span");
    expect(markup).not.toContain('<span class="unsafe">unsafe</span>');
  });
});

describe("openMarkdownLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prefers Zotero.launchURL when available", () => {
    const preventDefault = vi.fn();
    const launchURL = vi.fn();
    vi.stubGlobal("Zotero", { launchURL });

    openMarkdownLink("https://agentpaper.ai", {
      preventDefault,
    } as Pick<MouseEvent, "preventDefault">);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(launchURL).toHaveBeenCalledWith("https://agentpaper.ai");
  });
});
