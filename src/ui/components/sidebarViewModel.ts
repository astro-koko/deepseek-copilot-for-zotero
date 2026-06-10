import type { ChatSessionState } from "../../services/chatSession";
import type { AssembledContext } from "../../services/contextAssembler";
import {
  getPresetsForScope,
  type CommandPresetGroup,
} from "../../services/presets";
import type { Settings } from "../../services/settingsManager";
import type { ScopeContext } from "../../types/scope";
import type { Thread } from "../../types/thread";
import { isChineseLocale } from "../../utils/locale";

export type SidebarMode = "empty" | "config-error" | "home" | "thread";

export interface SidebarSuggestedAction {
  description: string;
  group: CommandPresetGroup;
  id: string;
  label: string;
  prompt: string;
}

export interface SidebarViewModel {
  addSourceLabel: string;
  chatSectionLabel: string;
  composerDisabled: boolean;
  composerDisabledReason: string | null;
  composerPlaceholder: string;
  contextAvailabilityLabel: string | null;
  contextWarnings: string[];
  currentFileLabel: string;
  heroBody: string;
  heroTitle: string;
  locationLabel: string;
  mode: SidebarMode;
  noticeText: string | null;
  noticeTitle: string | null;
  providerLabel: string;
  recentThreads: Thread[];
  recentThreadsLabel: string;
  scopeLabel: string;
  scopeMeta: string | null;
  scopeSelectionLabel: string | null;
  scopeSectionLabel: string;
  scopeTypeLabel: string;
  showRecentThreads: boolean;
  showShell: true;
  showSuggestedActions: boolean;
  showThreadView: boolean;
  statusLabel: string;
  streamingLabel: string;
  suggestedActionsLabel: string;
  newThreadLabel: string;
  openSettingsLabel: string;
  settingsLabel: string;
  sendLabel: string;
  suggestedActions: SidebarSuggestedAction[];
}

interface BuildSidebarViewModelArgs {
  contextSummary?: AssembledContext | null;
  location: "library" | "reader";
  recentThreads: Thread[];
  scope: ScopeContext | null;
  session: ChatSessionState;
  settings: Settings;
  settingsIssue: string | null;
}

const scopeTypeLabels: Record<string, string> = {
  collection: "Collection",
  "manual-selection": "Selection",
  paper: "Paper",
  pdf: "PDF",
};

const scopeTypeLabelsZh: Record<string, string> = {
  collection: "分类",
  "manual-selection": "选中内容",
  paper: "论文",
  pdf: "PDF",
};

type SupportedScopeContext = ScopeContext & { type: "paper" | "pdf" };

function isChatSupportedScope(
  scope: ScopeContext | null,
): scope is SupportedScopeContext {
  return scope?.type === "paper" || scope?.type === "pdf";
}

export function buildSidebarViewModel({
  contextSummary,
  location,
  recentThreads,
  scope,
  session,
  settings: _settings,
  settingsIssue,
}: BuildSidebarViewModelArgs): SidebarViewModel {
  const zh = isChineseLocale();
  const newThreadLabel = zh ? "新对话" : "New Thread";
  const recentThreadsLabel = zh ? "最近会话" : "Recent Chats";
  const settingsLabel = zh ? "设置" : "Settings";
  const openSettingsLabel = zh ? "打开设置" : "Open Settings";
  const scopeSectionLabel = zh ? "上下文" : "Context";
  const chatSectionLabel = zh ? "对话" : "Chat";
  const suggestedActionsLabel = zh ? "建议操作" : "Suggested actions";
  const streamingLabel = zh ? "正在回复" : "Responding";
  const addSourceLabel = zh ? "添加来源" : "Add Source";
  const currentFileLabel = zh ? "当前文件" : "Current file";
  const sendLabel = zh ? "发送" : "Send";
  const locationLabel = zh
    ? location === "reader"
      ? "阅读器"
      : "文献库"
    : location === "reader"
      ? "Reader"
      : "Library";
  const providerLabel = "DeepSeek";
  const filteredRecentThreads = recentThreads.filter(
    (thread) => thread.id !== session.activeThread?.id,
  );
  const contextAvailabilityLabel = contextSummary
    ? mapContextAvailabilityLabel(contextSummary.availability)
    : null;
  const contextWarnings = contextSummary?.warnings || [];

  if (!scope) {
    return {
      addSourceLabel,
      chatSectionLabel,
      composerDisabled: true,
      composerDisabledReason:
        zh
          ? "在文献库中选择一篇论文，或在阅读器中打开一个 PDF 以启用对话。"
          : "Choose one paper in Library or open one PDF in Reader to enable chat.",
      composerPlaceholder:
        zh
          ? location === "reader"
            ? "打开 PDF 后开始提问。"
            : "选择一篇论文后开始提问。"
          : location === "reader"
            ? "Open a PDF to start asking questions."
            : "Select one paper to start asking questions.",
      contextAvailabilityLabel,
      contextWarnings,
      currentFileLabel,
      heroBody:
        zh
          ? location === "reader"
            ? "在阅读器中打开一个 PDF 以启用对话。"
            : "在文献库中选择一篇论文，或在阅读器中打开一个 PDF 以开始使用。"
          : location === "reader"
            ? "Open one PDF in Reader to enable chat."
            : "Choose one paper in Library or open one PDF in Reader to begin.",
      heroTitle:
        zh
          ? location === "reader"
            ? "打开 PDF"
            : "选择条目"
          : location === "reader"
            ? "Open a PDF"
            : "Select an item",
      locationLabel,
      mode: "empty",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: [],
      recentThreadsLabel,
      scopeLabel:
        zh
          ? location === "reader"
            ? "当前没有 PDF 阅读器上下文"
            : "当前没有选中文献库上下文"
          : location === "reader"
            ? "No PDF reader context"
            : "No library context selected",
      scopeMeta: null,
      scopeSelectionLabel: null,
      scopeSectionLabel,
      scopeTypeLabel: location === "reader" ? locationLabel : locationLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: zh ? "等待上下文" : "Waiting for context",
      streamingLabel,
      suggestedActionsLabel,
      newThreadLabel,
      openSettingsLabel,
      settingsLabel,
      sendLabel,
      suggestedActions: [],
    };
  }

  const scopeTypeLabel = zh
    ? scopeTypeLabelsZh[scope.type] || scope.type
    : scopeTypeLabels[scope.type] || scope.type;
  const scopeMeta =
    scope.itemIds.length > 1
      ? zh
        ? `${scope.itemIds.length} 项在当前范围内`
        : `${scope.itemIds.length} items in scope`
      : null;
  const scopeSelectionLabel = scope.selectedText
    ? zh
      ? "已包含选中文本"
      : "Selected text included"
    : null;
  const supportedScope = isChatSupportedScope(scope);

  if (settingsIssue) {
    return {
      addSourceLabel,
      chatSectionLabel,
      composerDisabled: true,
      composerDisabledReason:
        zh
          ? "打开发插件设置并填写 DeepSeek API Key 后即可发送消息。"
          : "Open plugin Settings and add your DeepSeek API key before sending messages.",
      composerPlaceholder: zh
        ? "在设置中填写 API Key 以启用对话。"
        : "Add your API key in Settings to enable chat.",
      contextAvailabilityLabel,
      contextWarnings,
      currentFileLabel,
      heroBody: zh ? "请在设置中填写 DeepSeek API Key。" : "Add your DeepSeek API key in Settings.",
      heroTitle: zh ? "需要配置" : "Configuration required",
      locationLabel,
      mode: "config-error",
      noticeText: settingsIssue,
      noticeTitle: zh ? "需要配置" : "Configuration required",
      providerLabel,
      recentThreads: filteredRecentThreads,
      recentThreadsLabel,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeSectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: zh ? "需要设置" : "Needs setup",
      streamingLabel,
      suggestedActionsLabel,
      newThreadLabel,
      openSettingsLabel,
      settingsLabel,
      sendLabel,
      suggestedActions: [],
    };
  }

  if (!supportedScope) {
    return {
      addSourceLabel,
      chatSectionLabel,
      composerDisabled: true,
      composerDisabledReason:
        zh
          ? "在文献库中选择一篇论文，或在阅读器中打开一个 PDF 以启用对话。"
          : "Choose one paper in Library or open one PDF in Reader to enable chat.",
      composerPlaceholder:
        zh
          ? "选择一篇论文或当前 PDF 以启用对话。"
          : "Choose one paper or the active PDF to enable chat.",
      contextAvailabilityLabel,
      contextWarnings,
      currentFileLabel,
      heroBody:
        zh ? "当前仅支持单篇论文或活动 PDF。" : "Use one paper or the active PDF.",
      heroTitle: zh ? "选择一篇论文" : "Choose one paper",
      locationLabel,
      mode: "empty",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: filteredRecentThreads,
      recentThreadsLabel,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeSectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: zh ? "范围受限" : "Limited scope",
      streamingLabel,
      suggestedActionsLabel,
      newThreadLabel,
      openSettingsLabel,
      settingsLabel,
      sendLabel,
      suggestedActions: [],
    };
  }

  const hasThreadMessages = Boolean(session.activeThread?.messages.length);
  const suggestedActions = getPresetsForScope(scope.type)
    .map((preset) => ({
      description: preset.description,
      group: preset.group,
      id: preset.id,
      label: preset.label,
      prompt: preset.promptPrefix,
    }));

  if (hasThreadMessages) {
    return {
      addSourceLabel,
      chatSectionLabel,
      composerDisabled: false,
      composerDisabledReason: null,
      composerPlaceholder: buildComposerPlaceholder(scope),
      contextAvailabilityLabel,
      contextWarnings,
      currentFileLabel,
      heroBody: zh ? "继续当前会话。" : "Continue the current thread.",
      heroTitle: zh ? "当前会话" : "Thread",
      locationLabel,
      mode: "thread",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: filteredRecentThreads,
      recentThreadsLabel,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeSectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: true,
      statusLabel: zh ? "已就绪" : "Ready",
      streamingLabel,
      suggestedActionsLabel,
      newThreadLabel,
      openSettingsLabel,
      settingsLabel,
      sendLabel,
      suggestedActions,
    };
  }

  return {
    addSourceLabel,
    chatSectionLabel,
    composerDisabled: false,
    composerDisabledReason: null,
    composerPlaceholder: buildComposerPlaceholder(scope),
    contextAvailabilityLabel,
    contextWarnings,
    currentFileLabel,
    heroBody: zh ? "选择一个操作，或直接针对当前论文提问。" : "Pick an action or ask about the current paper.",
    heroTitle: zh ? "准备就绪" : "Ready to chat",
    locationLabel,
    mode: "home",
    noticeText: null,
    noticeTitle: null,
    providerLabel,
    recentThreads: filteredRecentThreads,
    recentThreadsLabel,
    scopeLabel: scope.label,
    scopeMeta,
    scopeSelectionLabel,
    scopeSectionLabel,
    scopeTypeLabel,
    showRecentThreads: filteredRecentThreads.length > 0,
    showShell: true,
    showSuggestedActions: suggestedActions.length > 0,
    showThreadView: false,
    statusLabel: zh ? "已就绪" : "Ready",
    streamingLabel,
    suggestedActionsLabel,
    newThreadLabel,
    openSettingsLabel,
    settingsLabel,
    sendLabel,
    suggestedActions,
  };
}

function buildComposerPlaceholder(scope: SupportedScopeContext): string {
  const zh = isChineseLocale();
  if (scope.selectedText) {
    return zh
      ? "围绕这段选中文本或这篇论文提问..."
      : "Ask about this selection or paper...";
  }
  return zh
    ? "围绕这篇论文或这个 PDF 提问..."
    : "Ask about this paper or PDF...";
}

function mapContextAvailabilityLabel(
  availability: AssembledContext["availability"],
): string {
  const zh = isChineseLocale();
  switch (availability) {
    case "pdf-text-ready":
      return zh ? "PDF 正文可用" : "PDF text ready";
    case "fulltext-required-error":
      return zh ? "全文不可用" : "Full text unavailable";
    case "fulltext-unsupported-scope":
      return zh ? "范围不支持全文模式" : "Scope unsupported for full-text mode";
    case "abstract-only":
      return zh ? "已回退到摘要" : "Abstract fallback";
    case "metadata-only":
      return zh ? "仅元数据" : "Metadata only";
    case "collection-truncated":
      return zh ? "仅分类摘要" : "Collection summary only";
    default:
      return zh ? "上下文可用" : "Context available";
  }
}
