import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({ apiKey: "test-key" }));
vi.mock("./settingsManager", () => ({
  DEEPSEEK_BASE_URL: "https://api.deepseek.com",
  getSettings: () => settings,
}));

import { searchEvidence } from "./evidenceSearch";
import type { CurrentPaperIdentity } from "../types/evidence";

interface EvalCase {
  id: string;
  title: string;
  dois: string[];
  arxivIds: string[];
  question: string;
  selectedText: string;
  expect: {
    intent: string;
    minIndependentWorks: number;
    maxMainPaperInIndependent: number | null;
  };
}

// 用例与公开 fixture 一并提交：fixture 是公开论文的净化检索信封，
// 离线回放即可锁定"去重 + 主论文折叠 + 覆盖度"三条质量契约。
const serviceDir = fileURLToPath(new URL("./", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const casesDoc = JSON.parse(
  readFileSync(`${repoRoot}scripts/evidence-quality-cases.json`, "utf8"),
) as {
  relatedWorkPrompt: string;
  cases: Array<
    Omit<EvalCase, "question"> & { questionRef: string; question?: string }
  >;
};

function loadFixture(caseId: string): {
  searches: Array<{ query: string; count: number; envelope: unknown }>;
} {
  return JSON.parse(
    readFileSync(`${serviceDir}fixtures/evidence-eval/${caseId}.json`, "utf8"),
  );
}

describe("evidence search quality fixtures", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(casesDoc.cases.map((entry) => [entry.id, entry] as const))(
    "case %s meets its independent-work and folding contract offline",
    async (_caseId, entryRaw) => {
      const entry = entryRaw as EvalCase & {
        question?: string;
        questionRef?: string;
      };
      const question = entry.questionRef
        ? casesDoc.relatedWorkPrompt
        : entry.question || "";
      const fixture = loadFixture(entry.id);
      expect(
        fixture.searches.length,
        "fixture 缺失或为空，请重新录制",
      ).toBeGreaterThan(0);

      fetchMock.mockImplementation((_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const match = fixture.searches.find((s) => s.query === body.query);
        // 回放不到说明查询构造漂移：fixture 需要重新录制。
        expect(
          match,
          `查询 "${body.query}" 无对应 fixture，请重新录制`,
        ).toBeDefined();
        return Promise.resolve(new Response(JSON.stringify(match!.envelope)));
      });

      const currentPaper: CurrentPaperIdentity = {
        title: entry.title,
        dois: entry.dois,
        arxivIds: entry.arxivIds,
      };
      const result = await searchEvidence(
        question,
        {
          type: "paper",
          id: `paper-${entry.id}`,
          label: entry.title,
          itemIds: [1],
          ...(entry.selectedText ? { selectedText: entry.selectedText } : {}),
        },
        { currentPaper },
      );

      expect(result.plan?.intent).toBe(entry.expect.intent);
      // 覆盖度：独立相关作品数达标。
      expect(result.items.length).toBeGreaterThanOrEqual(
        entry.expect.minIndependentWorks,
      );
      // 主论文不得混入独立文献。
      const independentDois = new Set(
        result.items.flatMap((item) =>
          currentPaper.dois.filter((doi) =>
            item.url.toLowerCase().includes(doi.toLowerCase()),
          ),
        ),
      );
      expect(independentDois.size).toBe(0);
      // 同一作品的多站点记录已合并：URL 全部不同。
      const urls = result.items.map((item) => item.url);
      expect(new Set(urls).size).toBe(urls.length);
      // 折叠段存在或为空均合法，但计数必须自洽。
      expect(
        (result.mainPaperItems?.length || 0) + result.items.length,
      ).toBeGreaterThan(0);
    },
  );
});
