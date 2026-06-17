import type { ScopeType } from "../types/scope";
import { isChineseLocale } from "../utils/locale";
import {
  getSettings,
  parseCustomPresets,
  type ParsedCustomCommandPreset,
} from "./settingsManager";

export interface CommandPreset {
  id: string;
  label: string;
  description: string;
  promptPrefix: string;
  slashCommand?: string;
  aliases: string[];
  group: "reading" | "analysis" | "evidence";
  showInSidebar?: boolean;
  scopeHint?: ScopeType[];
  evidenceHint?: boolean;
}

export type CommandPresetGroup = CommandPreset["group"];

export const COMMAND_PRESET_GROUP_ORDER: CommandPresetGroup[] = [
  "reading",
  "analysis",
  "evidence",
];

export const DEFAULT_SIDEBAR_PRESET_IDS = [
  "summarize",
  "explain",
  "core-contribution",
  "method",
  "limitations",
  "verify-claim",
  "background",
  "related-work",
] as const;

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
    description: "Structured paper-level summary",
    promptPrefix:
      "Summarize this paper for an active researcher. Use short sections for research question, method, key findings, and why it matters. Distinguish what the paper directly states from your interpretation, and name any important uncertainty or missing context",
    slashCommand: "Summarize",
    aliases: ["summary", "overview"],
    group: "reading",
    showInSidebar: true,
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain a concept or passage",
    promptPrefix:
      "Explain the current concept, passage, or result in clear language for a researcher entering this topic. Define technical terms, connect the explanation to the paper's argument, and separate what is explicit in the text from helpful background inference",
    slashCommand: "Explain",
    aliases: ["clarify", "passage"],
    group: "reading",
    showInSidebar: true,
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "core-contribution",
    label: "Core Contribution",
    description: "Extract the main contribution",
    promptPrefix:
      "Identify the paper's core contribution. State the claimed novelty, why it matters, what evidence the authors provide, and what would still need stronger support or external verification",
    slashCommand: "Core Contribution",
    aliases: ["novelty", "contribution"],
    group: "reading",
    showInSidebar: true,
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "method",
    label: "Method",
    description: "Analyze the research method",
    promptPrefix:
      "Analyze the paper's method step by step. Describe the workflow, inputs, assumptions, evaluation setup, and likely failure modes. Separate methodological facts stated by the paper from your assessment of strengths and weaknesses",
    slashCommand: "Method",
    aliases: ["methodology", "approach"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "limitations",
    label: "Limitations",
    description: "Identify the main limitations",
    promptPrefix:
      "Identify the study's main limitations. Focus on method, data, assumptions, evaluation design, generalizability, and possible overclaims. For each limitation, say whether it is acknowledged by the paper or inferred from the evidence presented",
    slashCommand: "Limitations",
    aliases: ["weakness", "risk"],
    group: "analysis",
    showInSidebar: true,
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "verify-claim",
    label: "Verify Claim",
    description: "Check whether the conclusion holds up",
    promptPrefix:
      "Assess whether the paper's core conclusion is well supported. Separate what the paper directly supports, what is only plausible inference, and what requires external verification or additional evidence. List the highest-priority checks to perform next",
    slashCommand: "Verify Claim",
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
      "Add the background needed to read this paper well. Explain the field context, key terms, problem setup, and prerequisite ideas. Mark which points come from the paper and which points are external context that should be verified if used in writing",
    slashCommand: "Background",
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
      "Place this paper in the broader literature. Explain the research line it belongs to, the kinds of prior work it builds on, how it differs, and which neighboring directions are worth reading next. Flag claims that require external verification",
    slashCommand: "Related Work",
    aliases: ["literature", "related"],
    group: "evidence",
    scopeHint: ["paper", "pdf"],
    evidenceHint: true,
  },
];

const zhMap: Record<
  string,
  Pick<CommandPreset, "label" | "description" | "promptPrefix" | "slashCommand"> & {
    aliases: string[];
  }
> = {
  summarize: {
    label: "总结论文",
    description: "结构化总结研究问题、方法和结论",
    slashCommand: "总结论文",
    promptPrefix:
      "请面向正在读论文的研究者总结这篇论文。用简短小节说明研究问题、方法、关键发现和意义。请区分论文直接陈述的内容与你的解释，并指出重要不确定性或缺失背景",
    aliases: ["总结", "概览", "摘要"],
  },
  explain: {
    label: "通俗解释",
    description: "把难懂概念和段落讲清楚",
    slashCommand: "通俗解释",
    promptPrefix:
      "请面向刚进入这个主题的研究者解释当前概念、段落或结果。定义关键术语，说明它与论文整体论点的关系，并区分原文明确表达的内容和有助于理解的背景推断",
    aliases: ["解释", "看不懂", "讲清楚"],
  },
  "core-contribution": {
    label: "核心贡献",
    description: "提炼这篇论文真正的新意",
    slashCommand: "核心贡献",
    promptPrefix:
      "请识别这篇论文的核心贡献。说明作者声称的新意、为什么重要、论文提供了什么证据，以及哪些部分仍需要更强支持或外部查证",
    aliases: ["贡献", "创新点", "新意"],
  },
  method: {
    label: "方法拆解",
    description: "逐步分析论文方法和假设",
    slashCommand: "方法拆解",
    promptPrefix:
      "请逐步分析这篇论文的方法。说明流程、输入、关键假设、评估设置和可能失败模式。请区分论文陈述的方法事实与你对优缺点的判断",
    aliases: ["方法", "方法论", "技术路线"],
  },
  limitations: {
    label: "研究局限",
    description: "识别论文的弱点和边界",
    slashCommand: "研究局限",
    promptPrefix:
      "请识别这项研究的关键局限。重点考虑方法、数据、假设、评估设计、可推广性和可能的过度结论。每条局限请说明是论文自己承认的，还是你基于证据推断的",
    aliases: ["局限", "缺点", "风险"],
  },
  "verify-claim": {
    label: "查证结论",
    description: "检查结论是否真的站得住",
    slashCommand: "查证结论",
    promptPrefix:
      "请评估论文的核心结论是否得到充分支持。区分论文直接支持的内容、只是合理推断的内容，以及需要外部查证或额外证据的内容。最后列出最优先查证的事项",
    aliases: ["查证", "核验", "验证", "事实核查"],
  },
  background: {
    label: "补充背景",
    description: "补足理解这篇论文所需的背景",
    slashCommand: "补充背景",
    promptPrefix:
      "请补充理解这篇论文所需的背景。解释领域脉络、关键术语、问题设置和前置知识。请标明哪些来自论文，哪些是外部背景且在写作引用前需要查证",
    aliases: ["背景", "上下文", "入门背景"],
  },
  "related-work": {
    label: "相关工作",
    description: "把论文放回更大的研究脉络里",
    slashCommand: "相关工作",
    promptPrefix:
      "请把这篇论文放回更广泛的研究脉络中。说明它所属的研究线、通常建立在哪些前人工作之上、与它们可能有何不同，以及接下来值得阅读的相邻方向。请标出需要外部查证的判断",
    aliases: ["相关研究", "文献脉络", "邻近工作"],
  },
};

function localizePreset(
  preset: CommandPreset,
  zh = isChineseLocale(),
): CommandPreset {
  if (!zh || (preset as { customOverride?: boolean }).customOverride) {
    return preset;
  }

  return {
    ...preset,
    ...(zhMap[preset.id] || {}),
  };
}

export const PRESETS: CommandPreset[] = COMMAND_PRESETS;

export function getPresetSlashCommand(
  preset: Pick<CommandPreset, "id" | "label" | "slashCommand">,
): string {
  return (preset.slashCommand || preset.label || preset.id)
    .trim()
    .replace(/^\/+/, "")
    .replace(/\s+/g, "");
}

function matchesSlashCommandToken(
  preset: CommandPreset,
  token: string,
): boolean {
  const normalized = token.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return [preset.id, getPresetSlashCommand(preset), ...preset.aliases]
    .map((value) => value.trim().toLowerCase())
    .some((value) => value === normalized);
}

function hasRequiredPresetFields(
  preset: ParsedCustomCommandPreset,
): preset is ParsedCustomCommandPreset &
  Pick<CommandPreset, "label" | "promptPrefix"> {
  return Boolean(preset.label?.trim() && preset.promptPrefix?.trim());
}

function normalizeCustomPreset(
  preset: ParsedCustomCommandPreset,
  existingPreset?: CommandPreset,
): CommandPreset | null {
  if (existingPreset) {
    return {
      ...existingPreset,
      aliases: preset.aliases?.length ? preset.aliases : existingPreset.aliases,
      description: preset.description || existingPreset.description,
      evidenceHint:
        preset.evidenceHint === undefined
          ? existingPreset.evidenceHint
          : preset.evidenceHint,
      group: preset.group || existingPreset.group,
      id: existingPreset.id,
      label: preset.label?.trim() || existingPreset.label,
      promptPrefix: preset.promptPrefix?.trim() || existingPreset.promptPrefix,
      slashCommand:
        preset.slashCommand?.trim() || existingPreset.slashCommand || existingPreset.id,
      showInSidebar:
        preset.showInSidebar === undefined
          ? existingPreset.showInSidebar
          : preset.showInSidebar,
      scopeHint: preset.scopeHint || existingPreset.scopeHint,
      customOverride: true,
    } as CommandPreset & { customOverride: boolean };
  }

  if (!hasRequiredPresetFields(preset)) {
    return null;
  }

  return {
    aliases: preset.aliases || [],
    description: preset.description || preset.label,
    evidenceHint: preset.evidenceHint,
    group: preset.group || "reading",
    id: preset.id,
    label: preset.label.trim(),
    promptPrefix: preset.promptPrefix.trim(),
    slashCommand: preset.slashCommand?.trim() || preset.id,
    showInSidebar: preset.showInSidebar,
    scopeHint: preset.scopeHint,
    customOverride: true,
  } as CommandPreset & { customOverride: boolean };
}

function readConfiguredCustomPresets(): string {
  try {
    return getSettings().customPresets;
  } catch {
    return "";
  }
}

function getMergedPresets(customPresetsValue?: string): CommandPreset[] {
  const merged = [...COMMAND_PRESETS];
  const customPresets = parseCustomPresets(
    customPresetsValue ?? readConfiguredCustomPresets(),
  ).presets;

  for (const customPreset of customPresets) {
    const existingIndex = merged.findIndex(
      (preset) => preset.id === customPreset.id,
    );
    const normalized = normalizeCustomPreset(
      customPreset,
      existingIndex >= 0 ? merged[existingIndex] : undefined,
    );
    if (!normalized) {
      continue;
    }

    if (customPreset.hidden && existingIndex < 0) {
      continue;
    }

    if (customPreset.hidden) {
      if (existingIndex >= 0) {
        continue;
      }
    }

    if (existingIndex >= 0) {
      merged[existingIndex] = normalized;
    } else {
      merged.push(normalized);
    }
  }

  return merged;
}

export function getPresetById(
  id: string,
  customPresetsValue?: string,
): CommandPreset | undefined {
  return getMergedPresets(customPresetsValue).find(
    (preset) => preset.id === id,
  );
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

export function getPresetsForScope(
  scopeType: ScopeType,
  customPresetsValue?: string,
): CommandPreset[] {
  const presets = getMergedPresets(customPresetsValue).filter(
    (preset) => !preset.scopeHint || preset.scopeHint.includes(scopeType),
  );

  return presets.map((preset) => localizePreset(preset));
}

export function getSidebarPresetsForScope(
  scopeType: ScopeType,
  customPresetsValue?: string,
): CommandPreset[] {
  const presets = getPresetsForScope(scopeType, customPresetsValue);
  return DEFAULT_SIDEBAR_PRESET_IDS.map((id) =>
    presets.find((preset) => preset.id === id),
  ).filter(Boolean) as CommandPreset[];
}

export function getAllPresets(customPresetsValue?: string): CommandPreset[] {
  return getMergedPresets(customPresetsValue).map((preset) =>
    localizePreset(preset),
  );
}

export function filterPresets(
  query: string,
  scopeType: ScopeType,
  zh = isChineseLocale(),
  customPresetsValue?: string,
): CommandPreset[] {
  const normalized = query.trim().toLowerCase();
  const scopedPresets = getMergedPresets(customPresetsValue).filter(
    (preset) => !preset.scopeHint || preset.scopeHint.includes(scopeType),
  );
  const presets = zh
    ? scopedPresets.map((preset) => localizePreset(preset, zh))
    : scopedPresets;

  if (!normalized) {
    return presets;
  }

  return presets.filter((preset) => {
    const haystack = [
      preset.id,
      getPresetSlashCommand(preset),
      preset.label,
      preset.description,
      ...preset.aliases,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function applyPreset(
  presetId: string,
  userInput: string,
  customPresetsValue?: string,
): string {
  const preset = getPresetById(presetId, customPresetsValue);
  if (!preset) return userInput;
  const localizedPreset = localizePreset(preset);
  return `${localizedPreset.promptPrefix}\n\n${userInput}`.trim();
}

export function expandSlashCommandInput(
  userInput: string,
  scopeType: ScopeType,
  customPresetsValue?: string,
): string {
  const trimmed = userInput.trim();
  const match = trimmed.match(/^\/([^\s\n]+)(?:\s+([\s\S]*))?$/);
  if (!match) {
    return userInput;
  }

  const commandToken = match[1] || "";
  const remainder = match[2] || "";
  const preset = getMergedPresets(customPresetsValue)
    .filter((candidate) =>
      !candidate.scopeHint || candidate.scopeHint.includes(scopeType),
    )
    .find((candidate) => matchesSlashCommandToken(candidate, commandToken));

  if (!preset) {
    return userInput;
  }

  return applyPreset(preset.id, remainder, customPresetsValue);
}

export function getPresetWarning(
  _presetId: string,
  _currentScope: ScopeType,
): string | null {
  return null;
}
