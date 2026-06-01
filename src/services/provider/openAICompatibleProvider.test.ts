import { describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleProvider } from "./openAICompatibleProvider";

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

    expect((globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest).toMatchObject({
      endpoint: "https://api.deepseek.com/chat/completions",
      messageCount: 2,
      model: "deepseek-v4-flash",
      stream: true,
    });
    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest?.hasApiKey,
    ).toBe(true);
    expect(
      (globalThis as any).__aiAssistantDiagnostics?.lastProviderRequest?.apiKey,
    ).toBeUndefined();
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
    let text = "";
    for await (const chunk of response.stream) {
      text += chunk;
    }

    expect(text).toBe("Hello world");
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
    let text = "";
    for await (const chunk of response.stream) {
      text += chunk;
    }

    expect(text).toBe("Hello world!");
  });
});
