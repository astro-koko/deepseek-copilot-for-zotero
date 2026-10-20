import { describe, expect, it } from "vitest";

import {
  extractWorkIdentifiers,
  filterAndGroupEvidence,
  normalizeWorkTitle,
  titleSimilarity,
  type RawEvidenceRecord,
} from "./evidenceResultFilter";
import type { CurrentPaperIdentity } from "../types/evidence";

function record(
  overrides: Partial<RawEvidenceRecord> & { url: string },
): RawEvidenceRecord {
  return {
    title: "A paper title",
    snippet: "snippet text",
    queryIndex: 0,
    positionInQuery: 0,
    ...overrides,
  };
}

describe("extractWorkIdentifiers", () => {
  it("extracts and normalizes DOIs from doi.org URLs and bare text", () => {
    expect(
      extractWorkIdentifiers("https://doi.org/10.1093/MNRAS/stv429").dois,
    ).toEqual(["10.1093/mnras/stv429"]);
    expect(
      extractWorkIdentifiers("https://oa.mg/work/10.1093/mnras/stv429").dois,
    ).toEqual(["10.1093/mnras/stv429"]);
    expect(
      extractWorkIdentifiers("see doi:10.1038/s41586-021-03819-2.").dois,
    ).toEqual(["10.1038/s41586-021-03819-2"]);
  });

  it("extracts arXiv identifiers across hosts and strips version suffixes", () => {
    expect(
      extractWorkIdentifiers("https://arxiv.org/abs/1502.07359").arxivIds,
    ).toEqual(["1502.07359"]);
    expect(
      extractWorkIdentifiers("https://arxiv.org/abs/1502.07359v2").arxivIds,
    ).toEqual(["1502.07359"]);
    expect(
      extractWorkIdentifiers("https://scirate.com/arxiv/1502.07359").arxivIds,
    ).toEqual(["1502.07359"]);
    expect(
      extractWorkIdentifiers("https://ar5iv.labs.arxiv.org/html/2511.20856#12")
        .arxivIds,
    ).toEqual(["2511.20856"]);
    expect(
      extractWorkIdentifiers("预印本 arXiv:1706.03762 结论").arxivIds,
    ).toEqual(["1706.03762"]);
  });

  it("does not treat ADS bibcodes, catalog hashes or unrelated numbers as identifiers", () => {
    const ids = extractWorkIdentifiers(
      "https://ui.adsabs.harvard.edu/abs/2015MNRAS.449.1856J/exportcitation",
    );
    expect(ids.dois).toEqual([]);
    expect(ids.arxivIds).toEqual([]);
    expect(
      extractWorkIdentifiers(
        "https://explore.openaire.eu/search/publication?articleId=doi_dedup___::fa82703ab53a3047ed8471e462817304",
      ).dois,
    ).toEqual([]);
  });
});

describe("normalizeWorkTitle / titleSimilarity", () => {
  it("normalizes case, punctuation and whitespace", () => {
    expect(normalizeWorkTitle("  Attention Is All You Need! ")).toBe(
      "attention is all you need",
    );
  });

  it("scores near-identical titles high across sites and case styles", () => {
    expect(
      titleSimilarity(
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
        "Spectroscopic Confusion: Its Impact on Current and Future Extragalactic HI Surveys",
      ),
    ).toBeGreaterThanOrEqual(0.8);
  });

  it("strips catalog navigation suffixes before similarity comparison", () => {
    // 真实 smoke 中 OpenAIRE 记录页因长营销后缀漏判为主论文。
    expect(
      titleSimilarity(
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys - Please grant OpenAIRE to access and update your ORCID works",
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
      ),
    ).toBeGreaterThanOrEqual(0.8);
    expect(
      titleSimilarity(
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys - Skip to main content",
        "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
      ),
    ).toBeGreaterThanOrEqual(0.8);
  });

  it("scores different titles low", () => {
    expect(
      titleSimilarity(
        "From photometric surveys to H I intensity mapping",
        "Attention Is All You Need",
      ),
    ).toBeLessThan(0.5);
  });
});

describe("filterAndGroupEvidence", () => {
  const hiPaper: CurrentPaperIdentity = {
    title:
      "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
    dois: ["10.1093/mnras/stv429"],
    arxivIds: ["1502.07359"],
  };

  it("merges same-work records across sites keeping the best rerank score", () => {
    const filtered = filterAndGroupEvidence(
      [
        record({
          title:
            "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
          url: "https://katalog.lib.cas.cz/EdsRecord/edsair,x",
          rerankScore: 1.83,
          positionInQuery: 1,
        }),
        record({
          title:
            "Spectroscopic Confusion: Its Impact on Current and Future Extragalactic HI Surveys",
          url: "https://academic.oup.com/mnras/article/449/2/1856/1079712",
          rerankScore: 1.62,
          positionInQuery: 0,
        }),
        record({
          title: "Spectroscopic confusion (open access mirror)",
          url: "https://oa.mg/work/10.1093/mnras/stv429",
          rerankScore: 1.1,
          positionInQuery: 2,
        }),
      ],
      hiPaper,
    );
    expect(filtered.stats.workDupesMerged).toBe(2);
    // 三条同作记录折叠为一条主论文条目，保留分数最高者。
    expect(filtered.mainPaper).toHaveLength(1);
    expect(filtered.mainPaper[0].rerankScore).toBe(1.83);
    expect(filtered.independent).toHaveLength(0);
  });

  it("merges duplicates across queries and keeps the earlier position as tiebreak", () => {
    const filtered = filterAndGroupEvidence([
      record({
        title: "Distinct related survey paper",
        url: "https://example.org/a",
        rerankScore: 1.4,
        queryIndex: 1,
        positionInQuery: 0,
      }),
      record({
        title: "Distinct related survey paper",
        url: "https://mirror.example.org/b",
        rerankScore: 1.4,
        queryIndex: 0,
        positionInQuery: 3,
      }),
    ]);
    expect(filtered.independent).toHaveLength(1);
    expect(filtered.independent[0].queryIndex).toBe(0);
    expect(filtered.stats.workDupesMerged).toBe(1);
  });

  it("groups catalog records of the current paper by identifier and title similarity", () => {
    const filtered = filterAndGroupEvidence(
      [
        record({
          title:
            "Spectroscopic confusion: its impact on current and future extragalactic H I surveys",
          url: "https://ui.adsabs.harvard.edu/abs/2015MNRAS.449.1856J/exportcitation",
          rerankScore: 1.51,
        }),
        record({
          title:
            "Spectroscopic confusion: its impact on current and future extragalactic H i surveys - Journal Article",
          url: "https://academic.oup.com/mnras/article/449/2/1856/1079712",
          rerankScore: 1.63,
        }),
        // 真实 smoke 第 1 轮漏判的 OpenAIRE 记录页。
        record({
          title:
            "spectroscopic confusion its impact on current and future extragalactic h i surveys - Please grant OpenAIRE to access and update your ORCID works",
          url: "https://explore.openaire.eu/search/publication?articleId=doi_dedup___::fa82703ab53a3047ed8471e462817304",
          rerankScore: 1.48,
        }),
        record({
          title:
            "When is stacking confusing? The impact of confusion on stacking in deep H I galaxy surveys",
          url: "https://www.semanticscholar.org/paper/x",
          rerankScore: 1.35,
        }),
      ],
      hiPaper,
    );
    // ADS/OUP/OpenAIRE 是同一作品的目录页，折叠段语义下合并为一条代表记录。
    expect(filtered.mainPaper).toHaveLength(1);
    expect(filtered.mainPaper[0].rerankScore).toBe(1.63);
    expect(filtered.independent.map((item) => item.url)).toEqual([
      "https://www.semanticscholar.org/paper/x",
    ]);
  });

  it("treats a record with a current-paper arXiv identifier as the main paper even with a different title", () => {
    const filtered = filterAndGroupEvidence(
      [
        record({
          title: "Completely different listing title",
          url: "https://scirate.com/arxiv/1502.07359",
          rerankScore: 1.0,
        }),
      ],
      hiPaper,
    );
    expect(filtered.mainPaper).toHaveLength(1);
    expect(filtered.independent).toHaveLength(0);
  });

  it("does not merge short or numbered-variant titles that only look similar", () => {
    const filtered = filterAndGroupEvidence(
      [
        record({
          title: "Part I",
          url: "https://example.org/part1",
        }),
        record({
          title: "Part II",
          url: "https://example.org/part2",
        }),
      ],
      undefined,
    );
    expect(filtered.independent).toHaveLength(2);
  });

  it("sorts by rerank score descending with stable fallback for missing scores", () => {
    const filtered = filterAndGroupEvidence([
      record({
        title: "No score",
        url: "https://example.org/noscore",
        positionInQuery: 0,
      }),
      record({
        title: "Low",
        url: "https://example.org/low",
        rerankScore: 0.9,
        positionInQuery: 1,
      }),
      record({
        title: "High",
        url: "https://example.org/high",
        rerankScore: 1.7,
        positionInQuery: 2,
      }),
    ]);
    expect(filtered.independent.map((item) => item.url)).toEqual([
      "https://example.org/high",
      "https://example.org/low",
      "https://example.org/noscore",
    ]);
  });

  it("keeps main-paper records instead of deleting them and applies the injection limits", () => {
    // 标题必须彼此差异明显：字符 bigram 相似度对模板化标题
    // （number 0/1/2…）区分度低，会触发真实的误合。
    const independentTitles = [
      "Deep H I surveys toward the outer Galaxy",
      "Cosmological implications of a baryon dominated Universe",
      "The Arecibo Legacy Fast ALFA survey overview",
      "Neutral hydrogen in the Local Volume",
      "SKA1 science priority and survey strategy",
      "Weak lensing mass calibration of galaxy clusters",
      "Intensity mapping of the 21cm background",
      "Blind detection of low mass galaxies",
      "Environmental effects on the H I content",
      "Tully-Fisher relation at z greater than one",
      "Dwarf galaxy formation in filaments",
      "Simulating the circumgalactic medium",
    ];
    const many: RawEvidenceRecord[] = independentTitles.map((title, i) =>
      record({
        title,
        url: `https://example.org/work-${i}`,
        rerankScore: 1 + i / 20,
        positionInQuery: i,
      }),
    );
    // 目录页记录：标题与主论文相似度不足 0.44，但 URL 携带 DOI 可判定。
    for (let i = 0; i < 6; i += 1) {
      many.push(
        record({
          title: "Catalog listing page",
          url: `https://catalog.example.org/record-${i}?doi=10.1093/mnras/stv429`,
          rerankScore: 1.5,
          positionInQuery: i,
        }),
      );
    }
    const filtered = filterAndGroupEvidence(many, hiPaper);
    expect(filtered.independent).toHaveLength(8);
    expect(filtered.mainPaper).toHaveLength(1);
    expect(filtered.stats.rawCount).toBe(18);
    expect(filtered.stats.workDupesMerged).toBe(5);
    expect(filtered.stats.mainPaperByIdentifier).toBe(6);
  });

  it("reports stats covering every removed or grouped record", () => {
    const filtered = filterAndGroupEvidence(
      [
        record({
          title:
            "Spectroscopic confusion: its impact on current and future extragalactic H i surveys",
          url: "https://doi.org/10.1093/mnras/stv429",
          rerankScore: 1.9,
        }),
        record({
          title: "Unrelated but interesting work",
          url: "https://example.org/other",
          rerankScore: 1.2,
        }),
      ],
      hiPaper,
    );
    expect(filtered.stats).toEqual({
      rawCount: 2,
      urlDupesRemoved: 0,
      workDupesMerged: 0,
      mainPaperByIdentifier: 1,
      mainPaperByTitle: 0,
      independentBeforeLimit: 1,
      independentAfterLimit: 1,
      mainPaperAfterLimit: 1,
    });
  });
});
