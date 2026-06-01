import type { ChatSessionState } from "../../services/chatSession";
import type { AssembledContext } from "../../services/contextAssembler";
import { getPresetsForScope } from "../../services/presets";
import type { Settings } from "../../services/settingsManager";
import type { ScopeContext } from "../../types/scope";
import type { Thread } from "../../types/thread";

export type SidebarMode = "empty" | "config-error" | "home" | "thread";

export interface SidebarSuggestedAction {
  description: string;
  id: string;
  label: string;
  prompt: string;
}

export interface SidebarViewModel {
  composerDisabled: boolean;
  composerDisabledReason: string | null;
  composerPlaceholder: string;
  contextAvailabilityLabel: string | null;
  contextWarnings: string[];
  heroBody: string;
  heroTitle: string;
  locationLabel: string;
  mode: SidebarMode;
  noticeText: string | null;
  noticeTitle: string | null;
  providerLabel: string;
  recentThreads: Thread[];
  scopeLabel: string;
  scopeMeta: string | null;
  scopeSelectionLabel: string | null;
  scopeTypeLabel: string;
  showRecentThreads: boolean;
  showShell: true;
  showSuggestedActions: boolean;
  showThreadView: boolean;
  statusLabel: string;
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
  settings,
  settingsIssue,
}: BuildSidebarViewModelArgs): SidebarViewModel {
  const locationLabel = location === "reader" ? "Reader" : "Library";
  const providerLabel =
    settings.model === "deepseek-v4-pro" ? "DeepSeek Pro" : "DeepSeek Flash";
  const filteredRecentThreads = recentThreads.filter(
    (thread) => thread.id !== session.activeThread?.id,
  );
  const contextAvailabilityLabel = contextSummary
    ? mapContextAvailabilityLabel(contextSummary.availability)
    : null;
  const contextWarnings = contextSummary?.warnings || [];

  if (!scope) {
    return {
      composerDisabled: true,
      composerDisabledReason:
        location === "reader"
          ? "Choose one paper in Library or open one PDF in Reader to enable chat."
          : "Choose one paper in Library or open one PDF in Reader to enable chat.",
      composerPlaceholder:
        location === "reader"
          ? "Open a PDF to start asking questions."
          : "Select one paper to start asking questions.",
      contextAvailabilityLabel,
      contextWarnings,
      heroBody:
        location === "reader"
          ? "Open one PDF in Reader to enable chat."
          : "Choose one paper in Library or open one PDF in Reader to begin.",
      heroTitle:
        location === "reader" ? "Open a PDF" : "Select an item",
      locationLabel,
      mode: "empty",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: [],
      scopeLabel:
        location === "reader"
          ? "No PDF reader context"
          : "No library context selected",
      scopeMeta: null,
      scopeSelectionLabel: null,
      scopeTypeLabel: location === "reader" ? "Reader" : "Library",
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: "Waiting for context",
      suggestedActions: [],
    };
  }

  const scopeTypeLabel = scopeTypeLabels[scope.type] || scope.type;
  const scopeMeta =
    scope.itemIds.length > 1 ? `${scope.itemIds.length} items in scope` : null;
  const scopeSelectionLabel = scope.selectedText
    ? "Selected text included"
    : null;
  const supportedScope = isChatSupportedScope(scope);

  if (settingsIssue) {
    return {
      composerDisabled: true,
      composerDisabledReason:
        "Open plugin Settings and add your DeepSeek API key before sending messages.",
      composerPlaceholder: "Add your API key in Settings to enable chat.",
      contextAvailabilityLabel,
      contextWarnings,
      heroBody: "Add your DeepSeek API key in Settings.",
      heroTitle: "Configuration required",
      locationLabel,
      mode: "config-error",
      noticeText: settingsIssue,
      noticeTitle: "Configuration required",
      providerLabel,
      recentThreads: filteredRecentThreads,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: "Needs setup",
      suggestedActions: [],
    };
  }

  if (!supportedScope) {
    return {
      composerDisabled: true,
      composerDisabledReason:
        "Choose one paper in Library or open one PDF in Reader to enable chat.",
      composerPlaceholder:
        "Choose one paper or the active PDF to enable chat.",
      contextAvailabilityLabel,
      contextWarnings,
      heroBody:
        "Use one paper or the active PDF.",
      heroTitle: "Choose one paper",
      locationLabel,
      mode: "empty",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: filteredRecentThreads,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: false,
      statusLabel: "Limited scope",
      suggestedActions: [],
    };
  }

  const hasThreadMessages = Boolean(session.activeThread?.messages.length);
  const suggestedActions = getPresetsForScope(scope.type)
    .slice(0, 4)
    .map((preset) => ({
      description: preset.description,
      id: preset.id,
      label: preset.label,
      prompt: preset.promptPrefix,
    }));

  if (hasThreadMessages) {
    return {
      composerDisabled: false,
      composerDisabledReason: null,
      composerPlaceholder: buildComposerPlaceholder(scope),
      contextAvailabilityLabel,
      contextWarnings,
      heroBody: "Continue the current thread.",
      heroTitle: "Thread",
      locationLabel,
      mode: "thread",
      noticeText: null,
      noticeTitle: null,
      providerLabel,
      recentThreads: filteredRecentThreads,
      scopeLabel: scope.label,
      scopeMeta,
      scopeSelectionLabel,
      scopeTypeLabel,
      showRecentThreads: false,
      showShell: true,
      showSuggestedActions: false,
      showThreadView: true,
      statusLabel: "Ready",
      suggestedActions,
    };
  }

  return {
    composerDisabled: false,
    composerDisabledReason: null,
    composerPlaceholder: buildComposerPlaceholder(scope),
    contextAvailabilityLabel,
    contextWarnings,
    heroBody: "Pick an action or ask about the current paper.",
    heroTitle: "Ready to chat",
    locationLabel,
    mode: "home",
    noticeText: null,
    noticeTitle: null,
    providerLabel,
    recentThreads: filteredRecentThreads,
    scopeLabel: scope.label,
    scopeMeta,
    scopeSelectionLabel,
    scopeTypeLabel,
    showRecentThreads: filteredRecentThreads.length > 0,
    showShell: true,
    showSuggestedActions: suggestedActions.length > 0,
    showThreadView: false,
    statusLabel: "Ready",
    suggestedActions,
  };
}

function buildComposerPlaceholder(scope: SupportedScopeContext): string {
  if (scope.selectedText) {
    return "Ask about the selected text or the broader context...";
  }
  return "Ask about this paper, PDF, or reading context...";
}

function mapContextAvailabilityLabel(
  availability: AssembledContext["availability"],
): string {
  switch (availability) {
    case "pdf-text-ready":
      return "PDF text ready";
    case "abstract-only":
      return "Abstract fallback";
    case "metadata-only":
      return "Metadata only";
    case "collection-truncated":
      return "Collection summary only";
    default:
      return "Context available";
  }
}
