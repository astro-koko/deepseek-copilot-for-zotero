import type { ScopeType } from "../types/scope";
import { isChineseLocale } from "../utils/locale";

export interface CommandPreset {
  id: string;
  label: string;
  description: string;
  promptPrefix: string;
  aliases: string[];
  group: "reading" | "analysis" | "evidence";
  scopeHint?: ScopeType[];
  evidenceHint?: boolean;
}

export type CommandPresetGroup = CommandPreset["group"];

export const COMMAND_PRESET_GROUP_ORDER: CommandPresetGroup[] = [
  "reading",
  "analysis",
  "evidence",
];

const GROUP_LABELS: Record<CommandPresetGroup, { en: string; zh: string }> = {
  reading: {
    en: "Reading",
    zh: "阅读理解",
  },
  analysis: {
    en: "Critical analysis",
    zh: "批判分析",
  },
  evidence: {
    en: "Evidence boost",
    zh: "证据增强",
  },
};

const COMMAND_PRESETS: CommandPreset[] = [
  {
    id: "summarize",
    label: "Summarize",
    description: "Concise paper-level summary",
    promptPrefix:
      "Please provide a concise summary of this paper. Include the main research question, methodology, key findings, and conclusions. Keep it to 3-5 paragraphs.",
    aliases: ["summary", "overview"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain a concept or passage",
    promptPrefix:
      "Please explain the current concept, paragraph, or result in clear, accessible terms. Break down technical jargon and connect it back to the paper's broader argument.",
    aliases: ["clarify", "passage"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "core-contribution",
    label: "Core Contribution",
    description: "Extract the main contribution",
    promptPrefix:
      "Identify the paper's core contribution. Explain what is genuinely new, why it matters, and how the authors justify that contribution.",
    aliases: ["novelty", "contribution"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "method",
    label: "Method",
    description: "Analyze the research method",
    promptPrefix:
      "Analyze the methodology used in this paper. Explain the method step by step, its assumptions, and where the approach is likely to be strong or weak.",
    aliases: ["methodology", "approach"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "limitations",
    label: "Limitations",
    description: "Identify the main limitations",
    promptPrefix:
      "Identify the key limitations of this study. Consider methodology, data, assumptions, evaluation design, generalizability, and possible over-claims.",
    aliases: ["weakness", "risk"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "verify-claim",
    label: "Verify Claim",
    description: "Check whether the conclusion holds up",
    promptPrefix:
      "Assess whether the paper's central claim is well supported. Separate what is directly supported by the paper from what needs outside verification or stronger evidence.",
    aliases: ["verify", "fact-check", "evidence"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
    evidenceHint: true,
  },
  {
    id: "background",
    label: "Background",
    description: "Add missing background context",
    promptPrefix:
      "Provide the background context a researcher would need before reading this paper deeply. Explain the field context, key terms, and the problem setting.",
    aliases: ["context", "primer"],
    group: "evidence",
    scopeHint: ["paper", "pdf"],
    evidenceHint: true,
  },
  {
    id: "related-work",
    label: "Related Work",
    description: "Place the paper in the literature",
    promptPrefix:
      "Place this paper in the broader literature. Explain what prior work it builds on, where it differs, and what nearby directions a researcher should also know.",
    aliases: ["literature", "related"],
    group: "evidence",
    scopeHint: ["paper", "pdf"],
    evidenceHint: true,
  },
];

const zhMap: Record<
  string,
  Pick<CommandPreset, "label" | "description"> & { aliases: string[] }
> = {
  summarize: {
    label: "总结论文",
    description: "快速抓住研究问题、方法和结论",
    aliases: ["总结", "概览", "摘要"],
  },
  explain: {
    label: "通俗解释",
    description: "把难懂概念和段落讲清楚",
    aliases: ["解释", "看不懂", "讲清楚"],
  },
  "core-contribution": {
    label: "核心贡献",
    description: "提炼这篇论文真正的新意",
    aliases: ["贡献", "创新点", "新意"],
  },
  method: {
    label: "方法拆解",
    description: "逐步分析论文方法和假设",
    aliases: ["方法", "方法论", "技术路线"],
  },
  limitations: {
    label: "研究局限",
    description: "识别论文的弱点和边界",
    aliases: ["局限", "缺点", "风险"],
  },
  "verify-claim": {
    label: "查证结论",
    description: "检查结论是否真的站得住",
    aliases: ["查证", "核验", "验证", "事实核查"],
  },
  background: {
    label: "补充背景",
    description: "补足理解这篇论文所需的背景",
    aliases: ["背景", "上下文", "入门背景"],
  },
  "related-work": {
    label: "相关工作",
    description: "把论文放回更大的研究脉络里",
    aliases: ["相关研究", "文献脉络", "邻近工作"],
  },
};

export const PRESETS: CommandPreset[] = COMMAND_PRESETS;

export function getPresetById(id: string): CommandPreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

export function getPresetGroupLabel(
  group: CommandPresetGroup,
  zh = isChineseLocale(),
): string {
  const labels = GROUP_LABELS[group];
  if (!labels) {
    return group;
  }

  return zh ? labels.zh : labels.en;
}

export function getPresetsForScope(scopeType: ScopeType): CommandPreset[] {
  const presets = PRESETS.filter(
    (preset) => !preset.scopeHint || preset.scopeHint.includes(scopeType),
  );

  if (!isChineseLocale()) {
    return presets;
  }

  return presets.map((preset) => ({
    ...preset,
    ...(zhMap[preset.id] || {}),
  }));
}

export function filterPresets(
  query: string,
  scopeType: ScopeType,
  zh = isChineseLocale(),
): CommandPreset[] {
  const normalized = query.trim().toLowerCase();
  const scopedPresets = PRESETS.filter(
    (preset) => !preset.scopeHint || preset.scopeHint.includes(scopeType),
  );
  const presets = zh
    ? scopedPresets.map((preset) => ({
        ...preset,
        ...(zhMap[preset.id] || {}),
      }))
    : scopedPresets;

  if (!normalized) {
    return presets;
  }

  return presets.filter((preset) => {
    const haystack = [
      preset.label,
      preset.description,
      ...preset.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function applyPreset(presetId: string, userInput: string): string {
  const preset = getPresetById(presetId);
  if (!preset) return userInput;
  return `${preset.promptPrefix}\n\n${userInput}`.trim();
}

export function getPresetWarning(
  _presetId: string,
  _currentScope: ScopeType,
): string | null {
  return null;
}
