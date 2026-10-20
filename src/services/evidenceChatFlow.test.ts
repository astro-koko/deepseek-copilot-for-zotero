import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./settingsManager", () => ({
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  getSettings: () => ({
    apiKey: "test-key",
    baseURL: "https://api.deepseek.com",
    model: "deepseek-flash",
    thinkingEnabled: false,
  }),
}));
vi.mock("./contextAssembler", () => ({ assembleContext: vi.fn() }));

import { sendChatMessage } from "./chatEngine";

describe("search to chat request flow", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["success", "empty", "error"] as const)(
    "passes the real search service's %s outcome to the real chat provider",
    async (outcome) => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        outcome === "error"
          ? new Response("untrusted upstream body", { status: 429 })
          : new Response(
              JSON.stringify({
                results:
                  outcome === "empty"
                    ? []
                    : [
                        {
                          title: "Retrieved source",
                          url: "https://arxiv.org/abs/example",
                          snippet:
                            "A source excerpt that must reach the model.",
                        },
                      ],
              }),
            ),
      );
      // 零结果场景会触发 refine 决策调用：回答"足够"→ 不二搜。
      if (outcome === "empty") {
        fetchMock.mockResolvedValueOnce(
          new Response(
            'data: {"choices":[{"delta":{"content":"足够"}}]}\n\ndata: [DONE]\n\n',
          ),
        );
      }
      fetchMock.mockResolvedValueOnce(
        new Response(
          'data: {"choices":[{"delta":{"content":"fixture response"}}]}\n\ndata: [DONE]\n\n',
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendChatMessage(
        {
          id: "ephemeral-fixture",
          title: "Synthetic test",
          createdAt: 1,
          updatedAt: 1,
          messages: [
            {
              id: "q",
              role: "user",
              content: "Search arXiv for a source",
              timestamp: 1,
            },
          ],
        },
        undefined,
        { evidenceEnabled: true },
      );
      const chunks = [];
      for await (const chunk of result.stream) chunks.push(chunk);
      expect(chunks).toEqual(["fixture response"]);
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          String(url).includes("/v1/tools/search"),
        ).length,
      ).toBe(1);
      expect(fetchMock.mock.calls.at(-1)![0]).toBe(
        "https://api.deepseek.com/chat/completions",
      );
      const mainChatCall = fetchMock.mock.calls.at(-1)!;
      const request = JSON.parse(mainChatCall[1].body);
      const context = request.messages[0].content;
      expect(context).toContain("=== 本轮联网搜索状态 ===");
      if (outcome === "success") {
        expect(context).toContain("插件已完成真实联网检索");
        expect(context).toContain("--- 独立相关文献（1 条）---");
        expect(context).toContain(
          "A source excerpt that must reach the model.",
        );
        expect(context).toContain("https://arxiv.org/abs/example");
        expect(result.evidenceAuditMessage).toContain("独立文献 1 条");
      } else if (outcome === "empty") {
        expect(context).toContain("未找到可用结果");
      } else {
        expect(context).toContain("搜索失败");
        expect(result.evidenceAuditMessage).toContain("HTTP 429");
        expect(context).not.toContain("untrusted upstream body");
      }
    },
  );
});
