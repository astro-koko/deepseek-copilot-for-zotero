import { describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleProvider } from "./openAICompatibleProvider";

describe("openAICompatibleProvider", () => {
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
});
