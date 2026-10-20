import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ apiKey: "test-key" }));
vi.mock("./settingsManager", () => ({
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  getSettings: () => settings,
}));

import { searchEvidence } from "./evidenceSearch";
import type { CurrentPaperIdentity } from "../types/evidence";

function searchResponse(results: unknown[]): Response {
  return new Response(JSON.stringify({ results }));
}

describe("searchEvidence", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    settings.apiKey = "test-key";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("times out stalled response bodies as well as stalled connections", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}),
    });
    let rejection: unknown;
    void searchEvidence("arXiv").catch((error) => {
      rejection = error;
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain("Timed out");
  });

  it("calls the documented DeepSeek endpoint and preserves snippet-only results", async () => {
    fetchMock.mockResolvedValue(
      searchResponse([
        {
          title: "A paper",
          url: "https://arxiv.org/abs/example",
          snippet: "Source excerpt",
        },
      ]),
    );
    const result = await searchEvidence("arXiv research");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.deepseek.com/v1/tools/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
    expect(result.items[0].snippet).toBe("Source excerpt");
  });

  it("keeps the paper topic in the planned query when a long generic prompt consumes the budget", async () => {
    fetchMock.mockResolvedValue(searchResponse([]));
    const title =
      "Spectroscopic confusion: its impact on current and future extragalactic H i surveys";
    await searchEvidence(
      "请把这篇论文放回更广泛的研究脉络中并找相关文献。".repeat(8),
      {
        type: "paper",
        id: "paper",
        label: title,
        itemIds: [1],
      },
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toContain("Spectroscopic confusion");
    expect(Array.from(body.query).length).toBeLessThanOrEqual(128);
  });

  it("counts Unicode characters without cutting an astral character in half", async () => {
    fetchMock.mockResolvedValue(searchResponse([]));
    const question = "🛰".repeat(100);
    await searchEvidence(question);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Array.from(body.query).length).toBeLessThanOrEqual(128);
    expect(body.ori_question).toBeDefined();
  });

  it("sends ori_question with the original user question", async () => {
    fetchMock.mockResolvedValue(searchResponse([]));
    await searchEvidence("这个方向最近有什么进展？", {
      type: "paper",
      id: "paper",
      label: "HI surveys",
      itemIds: [1],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.ori_question).toBe("这个方向最近有什么进展？");
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.count).toBeLessThanOrEqual(50);
  });

  it("runs one fetch per planned query and reports the plan", async () => {
    // 成功侧返回非空，0-totals 回退路径不触发。
    fetchMock.mockResolvedValue(
      searchResponse([
        {
          title: "One planned query result",
          url: "https://example.org/one",
          summary: "kept",
        },
      ]),
    );
    const result = await searchEvidence(
      "请把这篇论文放回更广泛的研究脉络中。说明它所属的研究线、通常建立在哪些前人工作之上、与它们可能有何不同，以及接下来值得阅读的相邻方向。请标出需要外部查证的判断",
      {
        type: "paper",
        id: "paper",
        label: "HI surveys",
        itemIds: [1],
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.plan?.intent).toBe("related-work");
  });

  it("merges results when two queries are planned and isolates per-query failure", async () => {
    // 标题与问题主题词都存在且不同（拉丁问题侧）→ 两条计划。
    fetchMock
      .mockResolvedValueOnce(
        searchResponse([
          {
            title: "First query result",
            url: "https://example.org/first",
            snippet: "from q1",
          },
        ]),
      )
      .mockResolvedValueOnce(new Response("server exploded", { status: 500 }));
    const result = await searchEvidence(
      "Find related work on spectroscopic confusion in surveys",
      {
        type: "paper",
        id: "paper",
        label: "Spectroscopic confusion in extragalactic surveys",
        itemIds: [1],
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.url)).toEqual([
      "https://example.org/first",
    ]);
    expect(result.plan?.queries.some((q) => q.status === "error")).toBe(true);
    expect(result.plan?.queries.some((q) => q.status === "success")).toBe(true);
  });

  it("keeps per-query error messages free of upstream response bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response("secret upstream body", { status: 403 }),
    );
    await expect(searchEvidence("research topic")).rejects.toThrow(
      "DeepSeek 搜索失败：HTTP 403",
    );
  });

  it("rejects malformed successful responses instead of reporting zero results", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "upstream failure" } })),
    );
    await expect(searchEvidence("arXiv")).rejects.toThrow("搜索响应格式无效");
  });

  it("keeps the HTTP status in the error without echoing arbitrary server bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response("private-server-body", { status: 429 }),
    );
    await expect(searchEvidence("arXiv")).rejects.toThrow("HTTP 429");
  });

  it("folds duplicate works and groups the current paper out of the independent items", async () => {
    const currentPaper: CurrentPaperIdentity = {
      title:
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
      dois: ["10.1093/mnras/stv429"],
      arxivIds: ["1502.07359"],
    };
    fetchMock.mockResolvedValue(
      searchResponse([
        {
          title:
            "Spectroscopic Confusion: Its Impact on Current and Future Extragalactic HI Surveys",
          url: "https://academic.oup.com/mnras/article/449/2/1856/1079712",
          summary: "OUP record",
          rerank_score: 1.83,
        },
        {
          title:
            "Spectroscopic confusion: its impact on current and future extragalactic H I surveys",
          url: "https://ui.adsabs.harvard.edu/abs/2015MNRAS.449.1856J/exportcitation",
          summary: "ADS record",
          rerank_score: 1.51,
        },
        {
          title: "A genuinely independent survey paper",
          url: "https://example.org/independent",
          summary: "Independent work",
          rerank_score: 1.2,
        },
      ]),
    );
    const result = await searchEvidence(
      "相关工作",
      {
        type: "paper",
        id: "paper",
        label: currentPaper.title,
        itemIds: [1],
      },
      { currentPaper },
    );
    expect(result.items.map((item) => item.url)).toEqual([
      "https://example.org/independent",
    ]);
    expect(result.mainPaperItems?.map((item) => item.url)).toEqual([
      "https://academic.oup.com/mnras/article/449/2/1856/1079712",
    ]);
    expect(result.plan?.workDupesMerged).toBe(1);
  });

  it("prefers the model-facing summary over raw page content when injecting", async () => {
    fetchMock.mockResolvedValue(
      searchResponse([
        {
          title: "A paper",
          url: "https://arxiv.org/abs/example",
          summary: "Model-facing summary text",
          content: "Raw page content that is much longer",
          rerank_score: 1.4,
        },
      ]),
    );
    const result = await searchEvidence("arXiv research");
    expect(result.items[0].summary).toBe("Model-facing summary text");
    expect(result.items[0].content).toBe(
      "Raw page content that is much longer",
    );
    expect(result.items[0].rerankScore).toBeCloseTo(1.4);
  });

  it("accepts an extra follow-up query through the same pipeline", async () => {
    fetchMock
      .mockResolvedValueOnce(
        searchResponse([
          {
            title: "Planned work",
            url: "https://example.org/planned",
            summary: "planned",
            rerank_score: 1.5,
          },
        ]),
      )
      .mockResolvedValueOnce(
        searchResponse([
          {
            title: "Model-guided follow-up",
            url: "https://example.org/refined",
            summary: "refined",
            rerank_score: 1.8,
          },
        ]),
      );
    const result = await searchEvidence(
      "相关工作",
      { type: "paper", id: "p", label: "HI surveys paper title", itemIds: [1] },
      { extraQuery: "WALLABY DR2 confusion HI mass function" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.query).toContain("WALLABY DR2");
    expect(
      result.items.some((item) => item.url === "https://example.org/refined"),
    ).toBe(true);
    expect(result.plan?.queries).toHaveLength(2);
  });

  it("retries a constraint-limited query without operators when it returns zero", async () => {
    fetchMock
      .mockResolvedValueOnce(searchResponse([])) // after: 限定落空
      .mockResolvedValueOnce(
        searchResponse([
          {
            title: "Unconstrained fallback hit",
            url: "https://example.org/fallback-hit",
            summary: "plain topic query succeeded",
            rerank_score: 1.2,
          },
        ]),
      );
    const result = await searchEvidence("这个方向最近有什么进展？", {
      type: "paper",
      id: "paper",
      label: "HI surveys over spectroscopic confusion",
      itemIds: [1],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.query).not.toContain("after:");
    expect(result.items.map((item) => item.url)).toEqual([
      "https://example.org/fallback-hit",
    ]);
    expect(result.plan?.queries).toHaveLength(2);
  });

  it("drops results without a usable URL or any evidence text", async () => {
    fetchMock.mockResolvedValue(
      searchResponse([
        { title: "no url", summary: "text" },
        { title: "no text", url: "https://example.org/x" },
        {
          title: "valid",
          url: "ftp://example.org/invalid-scheme",
          summary: "ignored scheme",
        },
        {
          title: "fine",
          url: "https://example.org/ok",
          summary: "kept",
        },
      ]),
    );
    const result = await searchEvidence("arXiv");
    expect(result.items.map((item) => item.url)).toEqual([
      "https://example.org/ok",
    ]);
  });
});
