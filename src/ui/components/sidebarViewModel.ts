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
  const providerLabel = `DeepSeek · ${settings.model}`;
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
          ? "Open a PDF in Zotero Reader to start chatting."
          : "Select a paper, a collection, or a PDF to start chatting.",
      composerPlaceholder:
        location === "reader"
          ? "Open a PDF to unlock the chat box."
          : "Select a Zotero item to unlock the chat box.",
      contextAvailabilityLabel,
      contextWarnings,
      heroBody:
        location === "reader"
          ? "The assistant appears here as soon as a PDF reader tab is active."
          : "Choose a paper, collection, or PDF in Zotero and the assistant will stay scoped to that context.",
      heroTitle:
        location === "reader" ? "Open a PDF to begin" : "Select a Zotero item",
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

  if (settingsIssue) {
    return {
      composerDisabled: true,
      composerDisabledReason:
        "Open plugin Settings and add your DeepSeek API key before sending messages.",
      composerPlaceholder: "Configure DeepSeek in Settings to enable chat.",
      contextAvailabilityLabel,
      contextWarnings,
      heroBody:
        "The sidebar is mounted correctly. Finish the plugin setup in Settings and the same panel will immediately become interactive.",
      heroTitle: "DeepSeek setup required",
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
      heroBody:
        "Continue the active conversation below, or switch to a recent thread without leaving the official Zotero sidebar.",
      heroTitle: session.activeThread?.title || "Active conversation",
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
    heroBody:
      "Use a suggested action to get moving fast, or type your own question in the composer below.",
    heroTitle:
      scope.type === "collection"
        ? "Compare papers in this collection"
        : "Start a conversation with this context",
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

function buildComposerPlaceholder(scope: ScopeContext): string {
  if (scope.selectedText) {
    return "Ask about the selected text or the broader context...";
  }
  if (scope.type === "collection" || scope.type === "manual-selection") {
    return "Compare themes, methods, or findings across this set...";
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
