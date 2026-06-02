import type { ScopeType } from "../types/scope";

function isChineseLocale(): boolean {
  try {
    const locale =
      (globalThis as unknown as { Zotero?: { locale?: string } }).Zotero?.locale ||
      ((globalThis as unknown as { Zotero?: { Prefs?: { get?: (key: string, global?: boolean) => unknown } } }).Zotero?.Prefs?.get?.("intl.accept_languages", true) as string) ||
      "";
    return String(locale).toLowerCase().startsWith("zh");
  } catch {
    return false;
  }
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  promptPrefix: string;
  scopeHint?: ScopeType[];
}

export const PRESETS: Preset[] = [
  {
    id: "summarize",
    label: "Summarize",
    description: "Concise paper-level summary",
    promptPrefix: "Please provide a concise summary of this paper. Include the main research question, methodology, key findings, and conclusions. Keep it to 3-5 paragraphs.",
    scopeHint: ["pdf", "paper"],
  },
  {
    id: "explain",
    label: "Explain",
    description: "Explain a concept or passage",
    promptPrefix: "Please explain the following in clear, accessible terms. Break down any technical jargon and provide context that would help someone new to this field understand it.",
    scopeHint: ["pdf", "paper"],
  },
  {
    id: "method",
    label: "Method",
    description: "Analyze methodology",
    promptPrefix: "Please analyze the methodology used in this paper. What are the strengths and limitations of their approach? What alternative methods could have been used?",
    scopeHint: ["pdf", "paper"],
  },
  {
    id: "limitations",
    label: "Limitations",
    description: "Identify limitations",
    promptPrefix: "What are the key limitations of this study? Consider sample size, methodology, generalizability, potential biases, and areas where the conclusions may be overstated.",
    scopeHint: ["pdf", "paper"],
  },
  {
    id: "compare",
    label: "Compare",
    description: "Compare multiple papers",
    promptPrefix: "Please compare and contrast the approaches, findings, and conclusions across these papers. Identify agreements, disagreements, and complementary insights.",
    scopeHint: ["collection", "manual-selection"],
  },
  {
    id: "related-work",
    label: "Related Work",
    description: "Analyze related work positioning",
    promptPrefix: "How does this paper position itself within the broader literature? What prior work does it build on, and how does it advance beyond existing research?",
    scopeHint: ["pdf", "paper"],
  },
];

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function getPresetsForScope(scopeType: ScopeType): Preset[] {
  const presets = PRESETS.filter(
    (p) => !p.scopeHint || p.scopeHint.includes(scopeType),
  );

  if (!isChineseLocale()) {
    return presets;
  }

  const zhMap: Record<string, Pick<Preset, "label" | "description">> = {
    summarize: { label: "总结", description: "生成论文级简明总结" },
    explain: { label: "解释", description: "解释概念或段落" },
    method: { label: "方法", description: "分析研究方法" },
    limitations: { label: "局限", description: "识别主要局限" },
    compare: { label: "对比", description: "对比多篇论文" },
    "related-work": { label: "相关工作", description: "分析相关工作定位" },
  };

  return presets.map((preset) => ({
    ...preset,
    ...(zhMap[preset.id] || {}),
  }));
}

export function applyPreset(presetId: string, userInput: string): string {
  const preset = getPresetById(presetId);
  if (!preset) return userInput;
  return `${preset.promptPrefix}\n\n${userInput}`;
}

export function getPresetWarning(
  presetId: string,
  currentScope: ScopeType,
): string | null {
  const preset = getPresetById(presetId);
  if (!preset) return null;

  if (preset.id === "compare" && (currentScope === "pdf" || currentScope === "paper")) {
    return "This preset works best with multiple papers. Try selecting a collection or multiple items.";
  }

  return null;
}
