import type { ScopeContext } from "../types/scope";

export type EvidenceIntent =
  | "related-work"
  | "recent-progress"
  | "fact-verification"
  | "general";

export interface PlannedQuery {
  query: string;
  count: number;
}

export interface EvidenceQueryPlan {
  intent: EvidenceIntent;
  queries: PlannedQuery[];
  oriQuestion: string;
  fallbackReason?: string;
}

const MAX_QUERY_CHARS = 128;
const MAX_ORI_QUESTION_CHARS = 128;

// 意图线索用子串匹配，不分词：中文线索靠词表，英文线索靠小写包含。
const RELATED_WORK_CLUES = [
  "相关工作",
  "文献脉络",
  "研究脉络",
  "前人",
  "相邻",
  "研究线",
  "放回",
  "related work",
  "prior work",
  "literature",
  "place this paper",
  "neighboring",
];
const RECENT_PROGRESS_CLUES = [
  "最新",
  "近期",
  "进展",
  "newest",
  "latest",
  "recent",
  "state of the art",
];
const FACT_VERIFICATION_CLUES = [
  "核查",
  "查证",
  "验证",
  "出处",
  "属实",
  "verify",
  "fact-check",
  "source check",
];

// 学术套话与提示词样板：这些词出现在查询里会稀释主题或拉回 meta 内容。
const STOPWORDS = [
  "请",
  "这篇",
  "论文",
  "说明",
  "它",
  "其",
  "通常",
  "建立",
  "哪些",
  "可能",
  "如何",
  "什么",
  "怎么",
  "是否",
  "以及",
  "还有",
  "需要",
  "标出",
  "判断",
  "解释",
  "分析",
  "总结",
  "研究",
  "当前",
  "以下",
  "如下",
  "基于",
  "关于",
  "the",
  "this",
  "these",
  "those",
  "that",
  "and",
  "for",
  "with",
  "from",
  "into",
  "onto",
  "what",
  "how",
  "why",
  "which",
  "when",
  "where",
  "explain",
  "describe",
  "summarize",
  "identify",
  "state",
  "claim",
  "claims",
  "paper",
  "papers",
  "study",
  "studies",
  "research",
  "external",
  "verification",
  "flag",
  "kind",
  "kinds",
  "prior",
  "work",
  "works",
  "line",
  "based",
  "next",
  "worth",
  "reading",
  "directions",
  "broader",
  "context",
  "place",
  "belongs",
];

export const MAX_QUERIES_PER_TURN = 2;

const RELATED_WORK_COUNT = 15;
const RECENT_PROGRESS_COUNT = 15;
const DEFAULT_COUNT = 10;
// 低于该长度的追问才可能被当作元请求。
const FOLLOW_UP_MAX_CHARS = 30;

// 元请求判定：极短、不含实质名词性内容（只有动词/客套/搜索指称）。
// 这些追问自己描述不了主题，需要上一轮的意图。
function isMetaFollowUp(question: string): boolean {
  if (Array.from(question).length > FOLLOW_UP_MAX_CHARS) {
    return false;
  }
  // 有任何 CJK 实词片段（长度≥4 的连续汉字）或拉丁内容词时不算元请求。
  if (/(?:[一-鿿]{4,})/u.test(question.replace(/联网|搜索|检索|查/g, ""))) {
    return false;
  }
  const latinWords = question
    .toLowerCase()
    .replace(/search|look ?up|verify|check|again|please|online/g, "")
    .match(/[a-z]{4,}/g);
  return !latinWords || latinWords.length === 0;
}

export function planEvidenceQueries(
  question: string,
  scope?: Pick<ScopeContext, "label" | "selectedText">,
  options?: {
    currentYear?: number;
    priorQuestion?: string;
    paperFullText?: string;
  },
): EvidenceQueryPlan {
  const trimmedQuestion = question.trim();
  const lowerQuestion = trimmedQuestion.toLowerCase();
  const title = (scope?.label || "").trim();
  const selectedText = (scope?.selectedText || "").trim();

  // 追问继承：只对"元请求型"短追问（如"需要你联网搜索""再查一次"）继承
  // 上一轮意图。带实质内容词的追问说不清与上一轮的关系，退回 general。
  const selfIntent = classifyIntent(lowerQuestion);
  let intent = selfIntent;
  let inheritedFromPrior = false;
  if (
    selfIntent === "general" &&
    options?.priorQuestion?.trim() &&
    isMetaFollowUp(trimmedQuestion)
  ) {
    const priorIntent = classifyIntent(options.priorQuestion.toLowerCase());
    if (priorIntent !== "general") {
      intent = priorIntent;
      inheritedFromPrior = true;
    }
  }

  // "YYYY年有…吗 / in YYYY" 式年份追问：升级为 recent-progress，
  // 以目标年份做 after: 下界。
  const yearMatch = trimmedQuestion.match(/(20\d{2})\s*年|in (20\d{2})\b/);
  let targetYear: number | undefined;
  if (yearMatch) {
    targetYear = Number(yearMatch[1] || yearMatch[2]);
    if (intent === "general" || inheritedFromPrior) {
      intent = "recent-progress";
    }
  }

  const titleKeywords = extractTopicKeywords(title, 72);
  const questionKeywords = extractTopicKeywords(trimmedQuestion, 48);

  const queries: PlannedQuery[] = [];
  let fallbackReason: string | undefined;

  if (intent === "fact-verification" && selectedText) {
    // 核查场景：选中文本的首句是最可靠的证据锚点。
    const phrase = truncateCharacters(firstSentence(selectedText), 60);
    queries.push({
      query: withBudget(`"${phrase}"`),
      count: DEFAULT_COUNT,
    });
  } else if (intent === "related-work") {
    // 标题主题词是最强锚点。精确排除把目录页踢掉（实测有效且无召回
    // 损失）：关键词在词边界压缩让位给闭合的排除短语。
    const buildExclusion = (keywords: string): string[] => {
      if (!title) return [];
      return [`-"${truncateCharacters(title, 64)}"`];
    };
    if (titleKeywords) {
      queries.push({
        query: withBudget(titleKeywords, buildExclusion(titleKeywords)),
        count: RELATED_WORK_COUNT,
      });
    }
    // 中文问题几乎全是引导句（无分词无法提炼主题），不为 CJK 问题侧
    // 生成第二条查询；拉丁问题侧在主题词与标题不同时补充。
    if (
      questionKeywords &&
      !/\p{Script=Han}/u.test(questionKeywords) &&
      normalizeForDedup(questionKeywords) !== normalizeForDedup(titleKeywords)
    ) {
      queries.push({
        query: withBudget(questionKeywords, buildExclusion(questionKeywords)),
        count: RELATED_WORK_COUNT,
      });
    }
    // 兜底：仍只有一条查询时，用论文全文的内容锚点（巡天/方法缩写、
    // 专名）换一个检索角度——后续工作讨论该题目时必然提到这些实体，
    // 而主题词搜不到只引 " Jones et al. 2015" 的施引文献。
    const anchorBudget = MAX_QUERIES_PER_TURN - queries.length;
    if (anchorBudget > 0 && options?.paperFullText) {
      const anchors = extractContentAnchors(options.paperFullText);
      if (anchors.length >= 2) {
        const anchorQuery = anchors.join(" ");
        if (
          normalizeForDedup(anchorQuery) !== normalizeForDedup(titleKeywords)
        ) {
          queries.push({
            query: withBudget(anchorQuery, buildExclusion(anchorQuery)),
            count: RELATED_WORK_COUNT,
          });
        }
      }
    }
    if (!titleKeywords && !questionKeywords) {
      fallbackReason = "无法从标题或问题提取主题词";
    }
  } else if (intent === "recent-progress") {
    const currentYear =
      targetYear ?? options?.currentYear ?? new Date().getFullYear();
    // 年份追问检索目标年份及之后的工作；普通"最新进展"回看两年。
    const sinceYear = targetYear != null ? targetYear : currentYear - 2;
    const topic = titleKeywords || questionKeywords;
    queries.push({
      query: withBudget(
        [topic, `after:${sinceYear}`].filter(Boolean).join(" "),
      ),
      count: RECENT_PROGRESS_COUNT,
    });
    if (!topic) {
      fallbackReason = "无法从标题或问题提取主题词";
    }
  } else if (inheritedFromPrior) {
    // 继承的 related-work：追加以问题发生时间起的年份限定，保证追问
    // 产生与上一轮不同的结果窗口，而不是重复同一批 general 词。
    const currentYear = options?.currentYear ?? new Date().getFullYear();
    const exclusion = title ? [`-"${truncateCharacters(title, 64)}"`] : [];
    if (titleKeywords) {
      queries.push({
        query: withBudget(
          [titleKeywords, `after:${currentYear - 3}`].filter(Boolean).join(" "),
          exclusion,
        ),
        count: RELATED_WORK_COUNT,
      });
    } else if (questionKeywords) {
      queries.push({
        query: withBudget(questionKeywords, exclusion),
        count: RELATED_WORK_COUNT,
      });
    }
    if (!titleKeywords && !questionKeywords) {
      fallbackReason = "无法从标题或问题提取主题词";
    }
  } else {
    // general：标题与问题主题词合并为一条查询。
    const combined = dedupeKeywords([titleKeywords, questionKeywords]).join(
      " ",
    );
    queries.push({
      query: withBudget(combined || truncateCharacters(title, 64)),
      count: DEFAULT_COUNT,
    });
    if (!combined && !title) {
      fallbackReason = "无范围标题且问题无可提取主题词";
    }
  }

  if (queries.length === 0) {
    queries.push({ query: "research", count: DEFAULT_COUNT });
  }

  return {
    intent,
    queries: dedupePlannedQueries(queries).slice(0, MAX_QUERIES_PER_TURN),
    oriQuestion: truncateCharacters(trimmedQuestion, MAX_ORI_QUESTION_CHARS),
    fallbackReason,
  };
}

function classifyIntent(lowerQuestion: string): EvidenceIntent {
  // 顺序敏感：相关工作提示词常附带"标出需要查证的判断"，但问题主体
  // 是文献定位，所以 related-work 必须先于 fact-verification 检查。
  if (RELATED_WORK_CLUES.some((clue) => lowerQuestion.includes(clue))) {
    return "related-work";
  }
  if (FACT_VERIFICATION_CLUES.some((clue) => lowerQuestion.includes(clue))) {
    return "fact-verification";
  }
  if (RECENT_PROGRESS_CLUES.some((clue) => lowerQuestion.includes(clue))) {
    return "recent-progress";
  }
  return "general";
}

export function extractTopicKeywords(text: string, maxChars: number): string {
  // 中文没有空格分词：包含 CJK 的片段不做 stopword 逐词剔除（对整句
  // 无效），而是截取前段；拉丁词仍按空格分词后剔除套话。
  const hasCjk = /\p{Script=Han}/u.test(text);
  if (hasCjk) {
    // 去掉提示词样式的引导句后，把 CJK 片段压成紧凑主题串。
    const compact = text
      .replace(/[，。！？；：、,.!?;:]+/g, " ")
      .split(/\s+/)
      .filter((part) => /\p{Script=Han}|[A-Za-z0-9]/u.test(part))
      .filter(
        (part) => !CJK_STOP_PHRASES.some((phrase) => part.includes(phrase)),
      )
      .join(" ");
    return truncateCharacters(compact.trim() || text.trim(), maxChars);
  }
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ""))
    .filter((token) => token.length > 1)
    .filter((token) => !STOPWORDS.includes(token.toLowerCase()));
  const keywords = tokens.join(" ").trim();
  return truncateCharacters(keywords, maxChars).trim();
}

// 中文提示词的高频样板片段：出现在片段里就丢弃该片段。
const CJK_STOP_PHRASES = [
  "请把",
  "说明它",
  "通常建立",
  "可能有何不同",
  "接下来值得",
  "需要外部查证",
  "本论文",
  "该论文",
  "这篇论文",
  "以下哪些",
];

// 内容锚点：从论文正文中提取大写缩写与专名（全大写 ≥3 字母，或首字母
// 大写的连续专名词）。后续工作讨论同一题目时必然提到这些实体，是
// 主题词搜不到的施引文献的替代检索角度。
const ALL_CAPS_ANCHOR = /\b[A-Z]{3,}[A-Za-z0-9]*\b/g;
const PROPER_NOUN_RUN = /\b(?:[A-Z][a-z]{2,}\s+){1,2}[A-Z][a-z]{2,}\b/g;
const ANCHOR_NOISE = new Set([
  "The",
  "This",
  "That",
  "These",
  "Those",
  "We",
  "In",
  "For",
  "Figure",
  "Table",
  "Section",
  "Appendix",
  "Equation",
  "Abstract",
  "Introduction",
  "Conclusion",
  "Results",
  "Discussion",
  "Method",
  "Methods",
  "Data",
  "Model",
  "File",
  "Available",
  "Online",
  "Copyright",
  "All",
  "Rights",
]);

export function extractContentAnchors(fullText: string): string[] {
  const counts = new Map<string, number>();
  const bump = (token: string): void => {
    if (ANCHOR_NOISE.has(token)) return;
    counts.set(token, (counts.get(token) || 0) + 1);
  };
  for (const match of fullText.matchAll(ALL_CAPS_ANCHOR)) {
    bump(match[0]);
  }
  for (const match of fullText.matchAll(PROPER_NOUN_RUN)) {
    bump(match[0]);
  }
  // 取出现频次最高者；频次意味着是全文反复讨论的核心概念而非偶然提及。
  const sorted = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);
  return sorted.slice(0, 6);
}

function dedupeKeywords(groups: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const token of group.split(" ")) {
      if (!token) continue;
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(token);
    }
  }
  return result;
}

function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupePlannedQueries(queries: PlannedQuery[]): PlannedQuery[] {
  const seen = new Set<string>();
  const result: PlannedQuery[] = [];
  for (const planned of queries) {
    const key = normalizeForDedup(planned.query);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(planned);
  }
  return result;
}

function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?。！？](?:\s|$)/);
  const sentence = match ? match[0] : text;
  return sentence.trim();
}

// 组装查询：关键词超预算时在完整词边界压缩；排除短语整体保留、
// 永不截断（未闭合的 -"…" 会破坏搜索语法）。
function withBudget(keywords: string, exclusions: string[] = []): string {
  const reservedChars = exclusions.reduce(
    (total, phrase) => total + Array.from(phrase).length + 1,
    0,
  );
  const keywordBudget = Math.max(MAX_QUERY_CHARS - reservedChars, 24);
  const compressed = truncateWords(keywords.trim(), keywordBudget);
  const query = [compressed, ...exclusions].filter(Boolean).join(" ").trim();
  return query || "research";
}

function truncateWords(text: string, limit: number): string {
  const chars = Array.from(text);
  if (chars.length <= limit) return text;
  // 在预算内回退到最后一个完整词，避免断词。
  const sliced = chars.slice(0, limit).join("");
  const lastSpace = sliced.lastIndexOf(" ");
  return lastSpace > limit * 0.5 ? sliced.slice(0, lastSpace) : sliced;
}

function truncateCharacters(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join("");
}
