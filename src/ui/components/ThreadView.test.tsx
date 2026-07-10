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
    vi.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue(
      "10:02:03 AM",
    );

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
    expect(markup).toContain("<pre style=");
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

  it("renders relative heading and table sizing for assistant markdown", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: [
              "# Title",
              "",
              "| A | B |",
              "| - | - |",
              "| 1 | 2 |",
            ].join("\n"),
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("Title");
    expect(markup).toContain("<table");
    expect(markup).toContain("font-size:1.26em");
    expect(markup).toContain("font-size:0.98em");
    expect(markup).toContain("font-size:1.04em");
    expect(markup).toContain("font-size:0.94em");
    expect(markup).not.toContain("font-size:16px");
    expect(markup).not.toContain("font-size:12px");
    expect(markup).not.toContain("font-size:11px");
  });

  it("renders a streaming assistant draft inside the message list", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        streamingMessage: {
          content: "Partial **answer**",
          reasoningContent: "Checking the method section",
          statusLabel: "Responding",
        },
        thread: makeThread([
          {
            id: "msg-user",
            role: "user",
            content: "Summarize this paper",
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("Responding");
    expect(markup).toContain("Checking the method section");
    expect(markup).toContain("<strong>answer</strong>");
  });

  it("renders display math blocks without exposing outer delimiters", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: [
              "模型为：",
              "$$",
              "C_F(q, y) = \\\\epsilon^2_{FG} \\\\sum_X A_X",
              "$$",
            ].join("\n"),
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("ai-assistant-math-block");
    expect(markup).toContain("katex-display");
    expect(markup).toContain("katex-html");
    expect(markup).toContain("mathnormal");
    expect(markup).not.toContain("$$");
    expect(markup).not.toContain("\\\\epsilon");
  });

  it("renders inline math without exposing dollar delimiters", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: "其中 $\\\\epsilon_{FG}=1$ 表示无前景去除。",
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("ai-assistant-math-inline");
    expect(markup).toContain("katex");
    expect(markup).toContain("katex-html");
    expect(markup).not.toContain("$\\\\epsilon");
  });

  it("renders inline math inside tight lists and emphasis", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: [
              "- **参数依据**: 振幅（$A_X$）和指数（$n_X$）参与计算。",
              "- 变量 **$k_{FG}$** 与 *$l_p$* 也应渲染。",
            ].join("\n"),
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup.match(/ai-assistant-math-inline/g)?.length).toBe(4);
    expect(markup).toContain("katex-html");
    expect(markup).not.toContain("$A_X$");
    expect(markup).not.toContain("$n_X$");
    expect(markup).not.toContain("$k_{FG}$");
    expect(markup).not.toContain("$l_p$");
  });

  it("keeps rendered chat message text selectable", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-user",
            role: "user",
            content: "请解释 $A_X$",
            timestamp: 1,
          },
          {
            id: "msg-assistant",
            role: "assistant",
            content: "回答里的文字和 $A_X$ 都需要能选中复制。",
            timestamp: 2,
          },
        ]),
      }),
    );

    expect(markup).toContain("ai-assistant-message-content");
    expect(markup).toContain("user-select:text");
    expect(markup).toContain("-moz-user-select:text");
    expect(markup).toContain("-webkit-user-select:text");
  });

  it("keeps malformed math visible instead of throwing", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: "坏公式 $\\notacommand{$ 也不能炸掉线程。",
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("ai-assistant-math-inline");
    expect(markup).toContain("katex-error");
    expect(markup).toContain("notacommand");
    expect(markup).toContain("也不能炸掉线程");
  });

  it("typesets streaming math through the same renderer", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        streamingMessage: {
          content: "流式输出 $\\alpha + \\beta$",
          reasoningContent: "$$\\sum_i x_i$$",
          statusLabel: "Responding",
        },
        thread: makeThread([]),
      }),
    );

    expect(markup).toContain("Responding");
    expect(markup).toContain("katex");
    expect(markup).toContain("katex-display");
    expect(markup).not.toContain("$$");
  });

  it("leaves dollar signs inside fenced code blocks as code", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ThreadView, {
        thread: makeThread([
          {
            id: "msg-assistant",
            role: "assistant",
            content: ["```tex", "$$", "E = mc^2", "$$", "```"].join("\n"),
            timestamp: 1,
          },
        ]),
      }),
    );

    expect(markup).toContain("<pre style=");
    expect(markup).toContain("E = mc^2");
    expect(markup).toContain("$$");
    expect(markup).not.toContain("ai-assistant-math-block");
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
