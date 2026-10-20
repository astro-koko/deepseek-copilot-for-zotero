// 手动评测运行器：对公开用例做真实 DeepSeek Search 往返并输出质量指标。
// 密钥只经 DEEPSEEK_API_KEY 环境变量注入；不写入文件、日志或打包产物。
// 401 立即停止，不重试。用法：
//   DEEPSEEK_API_KEY=sk-... node scripts/evidence-quality-eval.mjs \
//     --out docs/debug/2026-10-20-evidence-search-quality [--record-fixtures]
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const outDirArg = (() => {
  const index = process.argv.indexOf("--out");
  return index >= 0 ? process.argv[index + 1] : null;
})();
const recordFixtures = process.argv.includes("--record-fixtures");
const outDir = path.resolve(outDirArg || "docs/debug/evidence-search-quality");
const fixturesDir = path.resolve("src/services/fixtures/evidence-eval");

const key = process.env.DEEPSEEK_API_KEY;
if (!key) {
  console.error("缺少 DEEPSEEK_API_KEY 环境变量；拒绝运行。");
  process.exit(2);
}

const casesDoc = JSON.parse(
  await readFile("scripts/evidence-quality-cases.json", "utf-8"),
);
const promptByIdRef = {
  relatedWorkPrompt: casesDoc.relatedWorkPrompt,
};
const cases = casesDoc.cases.map((entry) => ({
  ...entry,
  question: entry.questionRef
    ? promptByIdRef[entry.questionRef]
    : entry.question,
}));

await mkdir(outDir, { recursive: true });
if (recordFixtures) {
  await mkdir(fixturesDir, { recursive: true });
}

// 把真实服务打包到 gitignored 运行目录，避免在 Node 里手工重写查询构造。
const runtimeDir = path.join(outDir, "runtime");
await mkdir(runtimeDir, { recursive: true });
await build({
  entryPoints: ["src/services/evidenceSearch.ts"],
  outdir: runtimeDir,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

// 最小 Zotero 全局：Prefs 供 settingsManager 读取；apiKey 由 Prefs 返回
// 环境变量注入的临时 key，不读真实 profile。调试日志 best-effort。
globalThis.Zotero = {
  locale: "en-US",
  Prefs: {
    get: (name) => {
      if (name.endsWith(".apiKey")) return key;
      if (name.endsWith(".thinkingEnabled")) return false;
      return undefined;
    },
  },
};
const { searchEvidence } = await import(
  pathToFileURL(path.join(runtimeDir, "evidenceSearch.js"))
);

// fetch 包装：录制净化后的响应信封供离线回归回放。
const nativeFetch = globalThis.fetch;
const recordedSearches = [];
globalThis.fetch = async (url, init) => {
  const response = await nativeFetch(url, {
    ...init,
    signal: AbortSignal.timeout(30000),
  });
  if (String(url).endsWith("/v1/tools/search") && response.ok) {
    const payload = await response.clone().json();
    recordedSearches.push({
      query: JSON.parse(init.body).query,
      count: JSON.parse(init.body).count,
      envelope: payload,
    });
  }
  return response;
};

function sanitizeEnvelope(envelope) {
  // 只保留公开检索结果的字段；丢弃任何非预期键。
  const results = (envelope.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    summary: item.summary,
    content: item.content,
    rerank_score: item.rerank_score,
    authority: item.authority,
    date: item.date,
    site_name: item.site_name,
  }));
  return { results };
}

const report = { startedAt: new Date().toISOString(), cases: [] };
let hadAuthError = false;

for (const entry of cases) {
  const caseResult = {
    caseId: entry.id,
    ranAt: new Date().toISOString(),
    independent: [],
    failures: [],
  };
  try {
    recordedSearches.length = 0;
    const result = await searchEvidence(
      entry.question,
      {
        type: "paper",
        id: `paper-${entry.id}`,
        label: entry.title,
        itemIds: [1],
        ...(entry.selectedText ? { selectedText: entry.selectedText } : {}),
      },
      {
        currentPaper: {
          title: entry.title,
          dois: entry.dois || [],
          arxivIds: entry.arxivIds || [],
        },
      },
    );
    caseResult.intent = result.plan?.intent || "unknown";
    caseResult.queries = result.plan?.queries || [];
    caseResult.independentCount = result.items.length;
    caseResult.mainPaperCount = result.mainPaperItems?.length || 0;
    caseResult.independent = result.items.map((item) => ({
      title: item.title,
      url: item.url,
      rerankScore: item.rerankScore ?? null,
      authority: item.authority ?? null,
      date: item.date ?? null,
    }));
    caseResult.avgRerank =
      result.items.length > 0
        ? result.items.reduce((sum, item) => sum + (item.rerankScore ?? 0), 0) /
          result.items.length
        : 0;
    caseResult.workDupesMerged = result.plan?.workDupesMerged ?? null;
    if (recordFixtures) {
      await writeFile(
        path.join(fixturesDir, `${entry.id}.json`),
        JSON.stringify(
          {
            searches: recordedSearches.map((s) => ({
              query: s.query,
              count: s.count,
              envelope: sanitizeEnvelope(s.envelope),
            })),
          },
          null,
          2,
        ) + "\n",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    caseResult.failures.push(message);
    if (/\b401\b|\b403\b/.test(message)) {
      hadAuthError = true;
    }
  }
  report.cases.push(caseResult);
  // 有界执行：用例间隔 1.2s，降低限流风险。
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

report.finishedAt = new Date().toISOString();
const outPath = path.join(outDir, "eval-results.json");
await writeFile(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(`已写入 ${outPath}`);
if (hadAuthError) {
  console.error("检测到 401/403；凭据无效，已停止（未重试）。");
  process.exit(3);
}
