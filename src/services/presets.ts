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
      "请用简洁的方式总结这篇论文。请涵盖核心研究问题、方法、关键发现和结论，控制在 3 到 5 段。",
    aliases: ["summary", "overview"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain a concept or passage",
    promptPrefix:
      "请用清晰、易懂的语言解释当前概念、段落或结果。拆解专业术语，并说明它与论文整体论点之间的关系。",
    aliases: ["clarify", "passage"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "core-contribution",
    label: "Core Contribution",
    description: "Extract the main contribution",
    promptPrefix:
      "请识别这篇论文的核心贡献。说明真正的新意是什么、为什么重要，以及作者是如何论证这项贡献的。",
    aliases: ["novelty", "contribution"],
    group: "reading",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "method",
    label: "Method",
    description: "Analyze the research method",
    promptPrefix:
      "请拆解这篇论文的方法。逐步说明方法流程、关键假设，以及该方法最可能强或弱的地方。",
    aliases: ["methodology", "approach"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "limitations",
    label: "Limitations",
    description: "Identify the main limitations",
    promptPrefix:
      "请识别这项研究的关键局限。考虑方法、数据、假设、评估设计、可推广性以及可能存在的过度结论。",
    aliases: ["weakness", "risk"],
    group: "analysis",
    scopeHint: ["paper", "pdf"],
  },
  {
    id: "verify-claim",
    label: "Verify Claim",
    description: "Check whether the conclusion holds up",
    promptPrefix:
      "请评估论文的核心结论是否得到充分支持。区分哪些内容是论文直接支持的，哪些部分需要额外查证或更强证据。",
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
      "请补充深入阅读这篇论文前所需的背景信息。解释相关领域背景、关键术语和问题设置。",
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
      "请把这篇论文放回更广泛的研究脉络中。说明它建立在哪些前人工作之上、与它们有何不同，以及还应关注哪些相邻方向。",
    aliases: ["literature", "related"],
    group: "evidence",
    scopeHint: ["paper", "pdf"],
    evidenceHint: true,
  },
];

const zhMap: Record<
  string,
  Pick<CommandPreset, "label" | "description" | "promptPrefix"> & {
    aliases: string[];
  }
> = {
  summarize: {
    label: "总结论文",
    description: "快速抓住研究问题、方法和结论",
    promptPrefix:
      "请用简洁的方式总结这篇论文。请涵盖核心研究问题、方法、关键发现和结论，控制在 3 到 5 段。",
    aliases: ["总结", "概览", "摘要"],
  },
  explain: {
    label: "通俗解释",
    description: "把难懂概念和段落讲清楚",
    promptPrefix:
      "请用清晰、易懂的语言解释当前概念、段落或结果。拆解专业术语，并说明它与论文整体论点之间的关系。",
    aliases: ["解释", "看不懂", "讲清楚"],
  },
  "core-contribution": {
    label: "核心贡献",
    description: "提炼这篇论文真正的新意",
    promptPrefix:
      "请识别这篇论文的核心贡献。说明真正的新意是什么、为什么重要，以及作者是如何论证这项贡献的。",
    aliases: ["贡献", "创新点", "新意"],
  },
  method: {
    label: "方法拆解",
    description: "逐步分析论文方法和假设",
    promptPrefix:
      "请拆解这篇论文的方法。逐步说明方法流程、关键假设，以及该方法最可能强或弱的地方。",
    aliases: ["方法", "方法论", "技术路线"],
  },
  limitations: {
    label: "研究局限",
    description: "识别论文的弱点和边界",
    promptPrefix:
      "请识别这项研究的关键局限。考虑方法、数据、假设、评估设计、可推广性以及可能存在的过度结论。",
    aliases: ["局限", "缺点", "风险"],
  },
  "verify-claim": {
    label: "查证结论",
    description: "检查结论是否真的站得住",
    promptPrefix:
      "请评估论文的核心结论是否得到充分支持。区分哪些内容是论文直接支持的，哪些部分需要额外查证或更强证据。",
    aliases: ["查证", "核验", "验证", "事实核查"],
  },
  background: {
    label: "补充背景",
    description: "补足理解这篇论文所需的背景",
    promptPrefix:
      "请补充深入阅读这篇论文前所需的背景信息。解释相关领域背景、关键术语和问题设置。",
    aliases: ["背景", "上下文", "入门背景"],
  },
  "related-work": {
    label: "相关工作",
    description: "把论文放回更大的研究脉络里",
    promptPrefix:
      "请把这篇论文放回更广泛的研究脉络中。说明它建立在哪些前人工作之上、与它们有何不同，以及还应关注哪些相邻方向。",
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

export function getPresetSlashCommand(preset: Pick<CommandPreset, "id">): string {
  return preset.id.trim();
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
