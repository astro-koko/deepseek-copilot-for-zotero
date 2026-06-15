import { describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleProvider } from "./openAICompatibleProvider";
import type { ChatStreamChunk } from "./types";

async function collectStream(stream: AsyncIterable<ChatStreamChunk>): Promise<{
  content: string;
  reasoning: string;
}> {
  let content = "";
  let reasoning = "";
  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      content += chunk;
    } else if (chunk.type === "reasoning_delta") {
      reasoning += chunk.content;
    }
  }

  return { content, reasoning };
}

describe("openAICompatibleProvider", () => {
  it("sends the selected model in the request body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller: ReadableStreamDefaultController) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-pro",
    });

    await provider.sendChat([{ role: "user", content: "hi" }]);

    const firstCall = fetchMock.mock.calls[0] as unknown as
      | [string, RequestInit]
      | undefined;
    if (!firstCall) {
      throw new Error("Expected fetch to be called once");
    }
    const requestInit = firstCall[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      messages: [{ role: "user", content: "hi" }],
      model: "deepseek-v4-pro",
    });
  });

  it("records the most recent non-sensitive request diagnostic for host smoke verification", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller: ReadableStreamDefaultController) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    await provider.sendChat([
      { role: "system", content: "ctx" },
      { role: "user", content: "hi" },
    ]);

    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest,
    ).toMatchObject({
      endpoint: "https://api.deepseek.com/chat/completions",
      messageCount: 2,
      model: "deepseek-v4-flash",
      stream: true,
    });
    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest
        ?.hasApiKey,
    ).toBe(true);
    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest?.apiKey,
    ).toBeUndefined();
  });

  it("records prompt and full-text character diagnostics for full-paper verification", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller: ReadableStreamDefaultController) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    await provider.sendChat(
      [
        {
          role: "system",
          content:
            "=== 上下文 ===\n标题：Paper\n\n=== 正文内容 ===\nFull PDF text body",
        },
        { role: "user", content: "最后一页讲了什么？" },
      ],
      undefined,
      {
        fullTextChars: 18,
        fullTextSource: "pdf-worker",
        systemPromptChars: 47,
      },
    );

    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest,
    ).toMatchObject({
      fullTextChars: 18,
      fullTextSource: "pdf-worker",
      systemPromptChars: 47,
    });
  });

  it("writes the latest provider request to a dedicated runtime diagnostic file", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller: ReadableStreamDefaultController) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Zotero", {
      File: {
        pathToFile: vi.fn((path: string) => path),
        putContents: vi.fn(),
      },
    });

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-pro",
    });

    await provider.sendChat([{ role: "user", content: "hello" }]);

    expect(Zotero.File.putContents).toHaveBeenCalledTimes(1);
    const diagnosticPayload = (
      Zotero.File.putContents as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[1];
    expect(String(diagnosticPayload)).toContain('"model": "deepseek-v4-pro"');
    expect(String(diagnosticPayload)).toContain('"messageCount": 1');
  });

  it("reassembles SSE frames that are split across chunks", async () => {
    const chunks = [
      new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hel'),
      new TextEncoder().encode(
        'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}]}\n\ndata: [DONE]\n\n',
      ),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller: ReadableStreamDefaultController) {
                chunks.forEach((chunk) => controller.enqueue(chunk));
                controller.close();
              },
            }),
          ),
      ),
    );

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    const response = await provider.sendChat([{ role: "user", content: "hi" }]);
    const { content } = await collectStream(response.stream);

    expect(content).toBe("Hello world");
  });

  it("parses CRLF-delimited SSE events and flushes the final buffered event on stream end", async () => {
    const chunks = [
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":" world"}}]}\r\n\r\n',
      ),
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"content":"!"}}]}\r\n\r\ndata: [DONE]',
      ),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller: ReadableStreamDefaultController) {
                chunks.forEach((chunk) => controller.enqueue(chunk));
                controller.close();
              },
            }),
          ),
      ),
    );

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    const response = await provider.sendChat([{ role: "user", content: "hi" }]);
    const { content } = await collectStream(response.stream);

    expect(content).toBe("Hello world!");
  });

  it("surfaces explicit provider reasoning deltas separately from answer text", async () => {
    const chunks = [
      new TextEncoder().encode(
        'data: {"choices":[{"delta":{"reasoning_content":"Check evidence. ","content":"Answer"}}]}\n\ndata: [DONE]\n\n',
      ),
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller: ReadableStreamDefaultController) {
                chunks.forEach((chunk) => controller.enqueue(chunk));
                controller.close();
              },
            }),
          ),
      ),
    );

    const provider = createOpenAICompatibleProvider({
      baseURL: "https://api.deepseek.com",
      apiKey: "test-key",
      model: "deepseek-v4-flash",
    });

    const response = await provider.sendChat([{ role: "user", content: "hi" }]);
    const { content, reasoning } = await collectStream(response.stream);

    expect(reasoning).toBe("Check evidence. ");
    expect(content).toBe("Answer");
  });
});
