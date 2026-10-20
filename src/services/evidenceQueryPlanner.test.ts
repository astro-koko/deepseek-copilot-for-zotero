import { describe, expect, it } from "vitest";

import {
  extractContentAnchors,
  planEvidenceQueries,
} from "./evidenceQueryPlanner";
import type { ScopeContext } from "../types/scope";

const HI_TITLE =
  "Spectroscopic confusion: its impact on current and future extragalactic H i surveys";

function scope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    type: "paper",
    id: "paper-1",
    label: HI_TITLE,
    itemIds: [1],
    ...overrides,
  };
}

describe("planEvidenceQueries", () => {
  const relatedWorkPrompt =
    "请把这篇论文放回更广泛的研究脉络中。说明它所属的研究线、通常建立在哪些前人工作之上、与它们可能有何不同，以及接下来值得阅读的相邻方向。请标出需要外部查证的判断";

  it("classifies the built-in related-work prompt and keeps topical keywords only", () => {
    const plan = planEvidenceQueries(relatedWorkPrompt, scope());
    expect(plan.intent).toBe("related-work");
    expect(plan.queries.length).toBeGreaterThanOrEqual(1);
    expect(plan.queries.length).toBeLessThanOrEqual(2);
    for (const planned of plan.queries) {
      expect(Array.from(planned.query).length).toBeLessThanOrEqual(128);
      // 意图样板词不得作为查询词：它们会拉回 meta/教程内容。
      expect(planned.query).not.toContain("研究脉络");
      expect(planned.query).not.toContain("相关工作");
      expect(planned.query).not.toContain("related work");
      expect(planned.query).not.toContain("external verification");
    }
    expect(
      plan.queries.some((q) => q.query.toLowerCase().includes("spectroscopic")),
    ).toBe(true);
    // 128 预算要同时容纳排除短语，关键词侧允许被压缩到核心词，
    // 但不得空或只剩样板。
    expect(
      plan.queries.some((q) => q.query.toLowerCase().includes("confusion")),
    ).toBe(true);
    expect(plan.oriQuestion).toBe(
      Array.from(relatedWorkPrompt).slice(0, 128).join(""),
    );
  });

  it("adds a closed full-title exclusion to related-work queries", () => {
    const plan = planEvidenceQueries(relatedWorkPrompt, scope());
    const exclusionQueries = plan.queries.filter((q) => q.query.includes('-"'));
    expect(exclusionQueries.length).toBeGreaterThan(0);
    for (const planned of exclusionQueries) {
      // 引号必须配对：未闭合的排除短语会破坏搜索语法。
      const quotes = Array.from(planned.query).filter(
        (ch) => ch === '"',
      ).length;
      expect(quotes % 2).toBe(0);
      // 排除短语是标题前段（预算内保持闭合），足够唯一。
      expect(planned.query).toContain(
        `-"Spectroscopic confusion: its impact on current and future extrag"`,
      );
    }
  });

  it("appends a recency operator for recent-progress questions", () => {
    const plan = planEvidenceQueries("这个方向最近两年有什么进展？", scope(), {
      currentYear: 2026,
    });
    expect(plan.intent).toBe("recent-progress");
    expect(plan.queries[0].query).toContain("after:2024");
  });

  it("uses an exact phrase from selected text for fact verification", () => {
    const plan = planEvidenceQueries(
      "核查该说法是否成立",
      scope({
        selectedText:
          "Multi-head attention allows the model to jointly attend to information",
      }),
    );
    expect(plan.intent).toBe("fact-verification");
    expect(plan.queries[0].query).toContain('"Multi-head attention allows');
  });

  it("falls back to a single general query without scope", () => {
    const plan = planEvidenceQueries("什么是光谱混淆？");
    expect(plan.intent).toBe("general");
    expect(plan.queries).toHaveLength(1);
    expect(plan.queries[0].query.trim().length).toBeGreaterThan(0);
    expect(Array.from(plan.queries[0].query).length).toBeLessThanOrEqual(128);
  });

  it("never returns an empty query even for an empty question", () => {
    const plan = planEvidenceQueries("   ", scope({ label: "" }));
    expect(plan.queries[0].query.trim()).not.toBe("");
  });

  it("deduplicates identical planned queries down to one", () => {
    const plan = planEvidenceQueries("spectroscopic confusion", scope());
    const queries = new Set(plan.queries.map((q) => q.query));
    expect(queries.size).toBe(plan.queries.length);
  });

  it("caps every query count within the documented API range", () => {
    const plan = planEvidenceQueries(relatedWorkPrompt, scope());
    for (const planned of plan.queries) {
      expect(planned.count).toBeGreaterThanOrEqual(1);
      expect(planned.count).toBeLessThanOrEqual(50);
    }
  });

  // —— 真实 smoke 记录暴露的追问场景（tmp/deepseek-copliot-*.md）——

  it("inherits the prior intent for short follow-up questions", () => {
    const plan = planEvidenceQueries("需要你联网搜索", scope(), {
      priorQuestion: relatedWorkPrompt,
    });
    expect(plan.intent).toBe("related-work");
    // 追问必须产生与上一轮不同的查询（带年份/变化），不是同一批 general 词。
    expect(
      plan.queries.some((q) => q.query.toLowerCase().includes("spectroscopic")),
    ).toBe(true);
  });

  it("applies an after: operator when a follow-up asks about a specific year", () => {
    const plan = planEvidenceQueries("2026年有相关的工作吗", scope(), {
      priorQuestion: relatedWorkPrompt,
      currentYear: 2026,
    });
    expect(plan.intent).toBe("recent-progress");
    expect(plan.queries.some((q) => q.query.includes("after:2026"))).toBe(true);
  });

  it("does not inherit intent when the follow-up is itself a full question", () => {
    const plan = planEvidenceQueries("这篇论文的摘要说了什么？", scope(), {
      priorQuestion: relatedWorkPrompt,
    });
    expect(plan.intent).toBe("general");
  });

  it("extracts content anchors (acronyms and proper nouns) from the paper full text", () => {
    // 真实论文里核心实体反复出现；锚点按频次筛选。
    const fullText = [
      "WALLABY and DINGO surveys will be dominated by source confusion.",
      "WALLABY forecasts use the HIMF from ALFALFA.",
      "DINGO and WALLABY both interact with the DMS12 model.",
      "ALFALFA and HIMF inputs drive the DINGO simulation.",
      "WALLABY HIMF DINGO comparison summary.",
      "普通中文句子不会成为锚点，英文小写词 also 不是。",
      "We thank Duffy for comments.",
    ].join("\n");
    const anchors = extractContentAnchors(fullText);
    expect(anchors).toContain("WALLABY");
    expect(anchors).toContain("DINGO");
    expect(anchors).toContain("ALFALFA");
    expect(anchors).toContain("HIMF");
    expect(anchors).not.toContain("Duffy");
    expect(anchors.length).toBeLessThanOrEqual(6);
  });

  it("uses content anchors as a second related-work search angle", () => {
    // 模拟真实频次：核心实体在全文反复出现（>=2 次）。
    const core = "WALLABY DINGO ALFALFA HIMF confusion. ";
    const fullText = core.repeat(6) + " filler sentence. ".repeat(60);
    const plan = planEvidenceQueries(relatedWorkPrompt, scope(), {
      paperFullText: fullText,
    });
    // 第二条查询用正文锚点，与标题主题词角度不同。
    expect(plan.queries.length).toBe(2);
    const second = plan.queries[1].query;
    expect(second).toContain("WALLABY");
    expect(second).not.toBe(plan.queries[0].query);
    expect(Array.from(second).length).toBeLessThanOrEqual(128);
  });
});
