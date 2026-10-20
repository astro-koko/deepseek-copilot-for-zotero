import type { CurrentPaperIdentity } from "../types/evidence";

export interface RawEvidenceRecord {
  title: string;
  url: string;
  snippet: string;
  summary?: string;
  content?: string;
  rerankScore?: number;
  authority?: number;
  date?: string | null;
  siteName?: string;
  queryIndex: number;
  positionInQuery: number;
}

export interface WorkIdentifiers {
  dois: string[];
  arxivIds: string[];
}

export interface EvidenceFilterStats {
  rawCount: number;
  urlDupesRemoved: number;
  workDupesMerged: number;
  mainPaperByIdentifier: number;
  mainPaperByTitle: number;
  independentBeforeLimit: number;
  independentAfterLimit: number;
  mainPaperAfterLimit: number;
}

export interface FilteredEvidenceGroup {
  independent: RawEvidenceRecord[];
  mainPaper: RawEvidenceRecord[];
  stats: EvidenceFilterStats;
}

export interface FilterAndGroupOptions {
  independentLimit?: number;
  mainPaperLimit?: number;
  titleMatchThreshold?: number;
}

const DOI_PATTERN = /10\.\d{4,9}\/[-._;()\/:a-z0-9]+/gi;
const ARXIV_PATTERN =
  /(?:arxiv\.org\/(?:abs|pdf)\/|scirate\.com\/arxiv\/|ar5iv\.labs\.arxiv\.org\/html\/|arxiv:)([0-9]{4}\.[0-9]{4,5})/gi;

const DEFAULT_INDEPENDENT_LIMIT = 8;
const DEFAULT_MAIN_PAPER_LIMIT = 4;
const DEFAULT_TITLE_MATCH_THRESHOLD = 0.8;
const MIN_TITLE_MATCH_LENGTH = 8;

function normalizeDoi(candidate: string): string {
  return candidate
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/[)\].,;]+$/, "");
}

export function extractWorkIdentifiers(text: string): WorkIdentifiers {
  const dois = new Set<string>();
  const arxivIds = new Set<string>();
  for (const match of text.matchAll(DOI_PATTERN)) {
    const normalized = normalizeDoi(match[0]);
    if (normalized.length >= 7 && normalized.length <= 80) {
      dois.add(normalized);
    }
  }
  for (const match of text.matchAll(ARXIV_PATTERN)) {
    arxivIds.add(match[1]);
  }
  return { dois: [...dois], arxivIds: [...arxivIds] };
}

export function normalizeWorkTitle(title: string): string {
  return stripCatalogTitleSuffixes(title)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 目录/索引站会把导航、营销或访问提示拼进标题尾段（"… - Skip to main
// content"、"… - Please grant OpenAIRE to access…"、"… - Get 20M+ …"）。
// 相似度比对前剥掉这些段，避免长后缀把 bigram 相似度拉破阈值。
const CATALOG_SUFFIX_CLUE =
  /openaire|orcid|skip to|sign in|log in|register|subscribe|trial|journal article|citation|export|download|pdf|full[- ]?text|premium|access|图书馆|目录|正文|下载|登录|注册|订阅/i;

function stripCatalogTitleSuffixes(title: string): string {
  const parts = title.split(/\s+-\s+/);
  if (parts.length <= 1) return title;
  const kept = parts.filter(
    (part, index) => index === 0 || !CATALOG_SUFFIX_CLUE.test(part),
  );
  return kept.join(" - ");
}

export function titleSimilarity(a: string, b: string): number {
  const left = normalizeWorkTitle(a);
  const right = normalizeWorkTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (
    left.length < MIN_TITLE_MATCH_LENGTH ||
    right.length < MIN_TITLE_MATCH_LENGTH
  ) {
    return 0;
  }
  const bigrams = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();
    for (let i = 0; i < text.length - 1; i += 1) {
      const gram = text.slice(i, i + 2);
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
    return counts;
  };
  const leftCounts = bigrams(left);
  const rightCounts = bigrams(right);
  let overlap = 0;
  for (const [gram, count] of leftCounts) {
    overlap += Math.min(count, rightCounts.get(gram) || 0);
  }
  const total = left.length - 1 + right.length - 1 || 1;
  return (2 * overlap) / total;
}

function recordIdentifiers(record: RawEvidenceRecord): WorkIdentifiers {
  return extractWorkIdentifiers(record.url);
}

function hasIdentifierOverlap(a: WorkIdentifiers, b: WorkIdentifiers): boolean {
  if (a.dois.some((doi) => b.dois.includes(doi))) return true;
  return a.arxivIds.some((id) => b.arxivIds.includes(id));
}

// 主论文判定：标识符命中是确认级证据；标题相似度只与当前论文的已知标题
// 比对（有锚定），不用于任意两条记录之间，避免模板化标题误合。
function isMainPaper(
  record: RawEvidenceRecord,
  identifiers: WorkIdentifiers,
  currentPaper: CurrentPaperIdentity,
  threshold: number,
): { match: boolean; byIdentifier: boolean } {
  const paperDois = new Set(currentPaper.dois.map((doi) => doi.toLowerCase()));
  if (identifiers.dois.some((doi) => paperDois.has(doi))) {
    return { match: true, byIdentifier: true };
  }
  if (identifiers.arxivIds.some((id) => currentPaper.arxivIds.includes(id))) {
    return { match: true, byIdentifier: true };
  }
  const normalizedTitle = normalizeWorkTitle(record.title);
  if (
    normalizedTitle.length >= MIN_TITLE_MATCH_LENGTH &&
    titleSimilarity(record.title, currentPaper.title) >= threshold
  ) {
    return { match: true, byIdentifier: false };
  }
  return { match: false, byIdentifier: false };
}

function preferCandidate(
  candidate: RawEvidenceRecord,
  incumbent: RawEvidenceRecord,
): boolean {
  const candidateScore = candidate.rerankScore ?? 0;
  const incumbentScore = incumbent.rerankScore ?? 0;
  if (candidateScore !== incumbentScore) {
    return candidateScore > incumbentScore;
  }
  // 稳定：先出现（更靠前的查询/位置）者保留。
  if (candidate.queryIndex !== incumbent.queryIndex) {
    return candidate.queryIndex < incumbent.queryIndex;
  }
  return candidate.positionInQuery < incumbent.positionInQuery;
}

function sortForInjection(records: RawEvidenceRecord[]): RawEvidenceRecord[] {
  return [...records].sort((a, b) => {
    const scoreA = a.rerankScore ?? 0;
    const scoreB = b.rerankScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (a.queryIndex !== b.queryIndex) return a.queryIndex - b.queryIndex;
    return a.positionInQuery - b.positionInQuery;
  });
}

interface WorkGroup {
  representative: RawEvidenceRecord;
  identifiers: WorkIdentifiers;
  normalizedTitle: string;
  mainPaper: boolean;
}

export function filterAndGroupEvidence(
  records: RawEvidenceRecord[],
  currentPaper?: CurrentPaperIdentity,
  options?: FilterAndGroupOptions,
): FilteredEvidenceGroup {
  const independentLimit =
    options?.independentLimit ?? DEFAULT_INDEPENDENT_LIMIT;
  const mainPaperLimit = options?.mainPaperLimit ?? DEFAULT_MAIN_PAPER_LIMIT;
  const titleThreshold =
    options?.titleMatchThreshold ?? DEFAULT_TITLE_MATCH_THRESHOLD;

  const stats: EvidenceFilterStats = {
    rawCount: records.length,
    urlDupesRemoved: 0,
    workDupesMerged: 0,
    mainPaperByIdentifier: 0,
    mainPaperByTitle: 0,
    independentBeforeLimit: 0,
    independentAfterLimit: 0,
    mainPaperAfterLimit: 0,
  };

  const groups: WorkGroup[] = [];

  const mergeable = (
    record: RawEvidenceRecord,
    identifiers: WorkIdentifiers,
    normalizedTitle: string,
    recordIsMainPaper: boolean,
    group: WorkGroup,
  ): boolean => {
    if (record.url === group.representative.url) return true;
    if (hasIdentifierOverlap(identifiers, group.identifiers)) return true;
    if (normalizedTitle && normalizedTitle === group.normalizedTitle) {
      return true;
    }
    // 两条都已判定为当前论文的页面时归并：折叠段语义就是
    // "当前论文的目录/索引页"，不需要再区分是哪个站点。
    return recordIsMainPaper && group.mainPaper;
  };

  for (const record of records) {
    const identifiers = recordIdentifiers(record);
    const normalizedTitle = normalizeWorkTitle(record.title);
    const mainPaperMatch = currentPaper
      ? isMainPaper(record, identifiers, currentPaper, titleThreshold)
      : { match: false, byIdentifier: false };
    const existing = groups.find((group) =>
      mergeable(
        record,
        identifiers,
        normalizedTitle,
        mainPaperMatch.match,
        group,
      ),
    );

    if (existing) {
      if (existing.representative.url === record.url) {
        stats.urlDupesRemoved += 1;
      } else {
        stats.workDupesMerged += 1;
      }
      existing.identifiers = {
        dois: [...new Set([...existing.identifiers.dois, ...identifiers.dois])],
        arxivIds: [
          ...new Set([
            ...existing.identifiers.arxivIds,
            ...identifiers.arxivIds,
          ]),
        ],
      };
      if (preferCandidate(record, existing.representative)) {
        existing.representative = record;
      }
      // 计数按记录条数累积（评测诊断口径：折叠了多少条）。
      if (mainPaperMatch.match) {
        if (mainPaperMatch.byIdentifier) stats.mainPaperByIdentifier += 1;
        else stats.mainPaperByTitle += 1;
      }
      continue;
    }

    if (mainPaperMatch.match) {
      if (mainPaperMatch.byIdentifier) stats.mainPaperByIdentifier += 1;
      else stats.mainPaperByTitle += 1;
    }
    groups.push({
      representative: record,
      identifiers,
      normalizedTitle,
      mainPaper: mainPaperMatch.match,
    });
  }

  const mainPaperRecords = groups
    .filter((group) => group.mainPaper)
    .map((group) => group.representative);
  const independentRecords = groups
    .filter((group) => !group.mainPaper)
    .map((group) => group.representative);

  const sortedIndependent = sortForInjection(independentRecords);
  const sortedMainPaper = sortForInjection(mainPaperRecords);

  stats.independentBeforeLimit = sortedIndependent.length;
  stats.independentAfterLimit = Math.min(
    sortedIndependent.length,
    independentLimit,
  );
  stats.mainPaperAfterLimit = Math.min(sortedMainPaper.length, mainPaperLimit);

  return {
    independent: sortedIndependent.slice(0, independentLimit),
    mainPaper: sortedMainPaper.slice(0, mainPaperLimit),
    stats,
  };
}
