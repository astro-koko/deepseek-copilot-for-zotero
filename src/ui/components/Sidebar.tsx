import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Composer } from "./Composer";
import { ThreadView } from "./ThreadView";
import { buildSidebarViewModel } from "./sidebarViewModel";
import {
  buildReaderActionDraft,
  mergeReaderActionScope,
  type ReaderActionDetail,
} from "../readerActionFlow";
import type { ScopeContext } from "../../types/scope";
import type { Thread } from "../../types/thread";
import { assembleContext, type AssembledContext } from "../../services/contextAssembler";
import { getCurrentScope } from "../../services/scopeResolver";
import {
  PREFERENCES_PANE_ID,
  getSettings,
  getSettingsIssue,
} from "../../services/settingsManager";
import { chatSessionStore } from "../../services/chatSession";
import { listThreads } from "../../services/threadController";

interface SidebarProps {
  eventBus: EventTarget;
  hostWindow: Window;
  location: "library" | "reader";
}

function isSupportedChatScope(scope: ScopeContext | null): scope is ScopeContext {
  return scope?.type === "paper" || scope?.type === "pdf";
}

export const Sidebar: React.FC<SidebarProps> = ({ eventBus, hostWindow, location }) => {
  const session = useSyncExternalStore(
    chatSessionStore.subscribe,
    chatSessionStore.getSnapshot,
  );
  const [scope, setScope] = useState<ScopeContext | null>(null);
  const [contextSummary, setContextSummary] = useState<AssembledContext | null>(null);
  const [settings, setSettings] = useState(getSettings);
  const [recentThreads, setRecentThreads] = useState<Thread[]>([]);
  const [showRecentChats, setShowRecentChats] = useState(false);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerFocusNonce, setComposerFocusNonce] = useState(0);

  useEffect(() => {
    const refreshSettings = () => {
      setSettings(getSettings());
    };

    refreshSettings();
    const handleSettingsChange = () => {
      refreshSettings();
    };
    hostWindow.addEventListener("focus", refreshSettings);
    eventBus.addEventListener("settingsChange", handleSettingsChange);
    return () => {
      hostWindow.removeEventListener("focus", refreshSettings);
      eventBus.removeEventListener("settingsChange", handleSettingsChange);
    };
  }, [eventBus, hostWindow]);

  useEffect(() => {
    let disposed = false;

    const loadRecentThreads = async () => {
      try {
        const nextThreads = await listThreads();
        if (!disposed) {
          setRecentThreads(nextThreads);
        }
      } catch (error) {
        ztoolkit.log("Failed to load recent threads:", error);
      }
    };

    void loadRecentThreads();
    return () => {
      disposed = true;
    };
  }, [session.activeThread?.id, session.activeThread?.updatedAt]);

  useEffect(() => {
    const syncScope = (nextScope: ScopeContext | null) => {
      setScope(nextScope);
      setContextSummary(summarizeScope(nextScope));
      void chatSessionStore.syncScope(nextScope);
    };

    const handleScopeChange = (event: Event) => {
      const nextScope = (event as CustomEvent).detail as ScopeContext | null;
      syncScope(nextScope);
    };

    eventBus.addEventListener("scopeChange", handleScopeChange);
    return () => eventBus.removeEventListener("scopeChange", handleScopeChange);
  }, [eventBus]);

  useEffect(() => {
    const handleReaderSelectionAction = (event: Event) => {
      const selectedType = (Zotero.getMainWindow() as any)?.Zotero_Tabs?.selectedType;
      if (selectedType !== location) {
        return;
      }

      const detail = (event as CustomEvent).detail as ReaderActionDetail;
      const prompt = buildReaderActionDraft(detail);
      const currentScope = mergeReaderActionScope(getCurrentScope(), detail);
      setScope(currentScope);
      setContextSummary(summarizeScope(currentScope));

      void (async () => {
        if (!isSupportedChatScope(currentScope)) {
          return;
        }

        await chatSessionStore.syncScope(currentScope);
        setShowRecentChats(false);

        if (detail.action === "explain") {
          setComposerDraft("");
          await chatSessionStore.send(prompt, currentScope);
          return;
        }

        setComposerDraft(prompt);
        setComposerFocusNonce((value) => value + 1);
      })().catch((error) => {
        ztoolkit.log("Failed to handle reader selection action:", error);
      });
    };

    eventBus.addEventListener("readerSelectionAction", handleReaderSelectionAction);
    return () =>
      eventBus.removeEventListener(
        "readerSelectionAction",
        handleReaderSelectionAction,
      );
  }, [eventBus, location]);

  useEffect(() => {
    const currentScope = getCurrentScope();
    setScope(currentScope);
    setContextSummary(summarizeScope(currentScope));
    void chatSessionStore.syncScope(currentScope);
  }, []);

  const handleNewThread = async () => {
    const currentScope = getCurrentScope();
    setScope(currentScope);
    setContextSummary(summarizeScope(currentScope));
    if (!isSupportedChatScope(currentScope)) {
      return;
    }
    await chatSessionStore.newThread(currentScope);
    setComposerDraft("");
    setShowRecentChats(false);
  };

  const handleSend = async (userInput: string) => {
    if (!isSupportedChatScope(scope)) {
      return;
    }

    try {
      await chatSessionStore.send(userInput, scope);
      setComposerDraft("");
      setSettings(getSettings());
      setShowRecentChats(false);
    } catch (error) {
      ztoolkit.log("Failed to send chat message:", error);
    }
  };

  const handlePresetSend = async (prompt: string) => {
    await handleSend(prompt);
  };

  const handleCancel = () => {
    chatSessionStore.cancel();
  };

  const handleOpenSettings = () => {
    try {
      Zotero.Utilities.Internal.openPreferences(PREFERENCES_PANE_ID);
    } catch (error) {
      ztoolkit.log("Failed to open plugin preferences:", error);
    }
  };

  const handleOpenThread = (thread: Thread) => {
    chatSessionStore.openThread(thread);
    setShowRecentChats(false);
  };

  const model = buildSidebarViewModel({
    contextSummary,
    location,
    recentThreads,
    scope,
    session,
    settings,
    settingsIssue: getSettingsIssue(settings),
  });
  const isRecentChatsVisible =
    model.recentThreads.length > 0 && (showRecentChats || model.showRecentThreads);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>DS Copilot</div>
          <div style={styles.headerTitle}>{model.locationLabel}</div>
        </div>
        <div style={styles.headerMeta}>
          <span style={styles.providerPill}>{model.providerLabel}</span>
          <span
            style={{
              ...styles.statusPill,
              ...(model.statusLabel === "Ready"
                ? styles.statusReady
                : styles.statusMuted),
            }}
          >
            {model.statusLabel}
          </span>
        </div>
      </div>

      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolbarButton,
            ...(isSupportedChatScope(scope) ? null : styles.toolbarButtonDisabled),
          }}
          onClick={() => {
            void handleNewThread();
          }}
          disabled={!isSupportedChatScope(scope) || session.isStreaming}
        >
          New Thread
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(model.recentThreads.length > 0 ? null : styles.toolbarButtonDisabled),
          }}
          onClick={() => setShowRecentChats((current) => !current)}
          disabled={model.recentThreads.length === 0}
        >
          Recent Chats
        </button>
        <button style={styles.toolbarButton} onClick={handleOpenSettings}>
          Settings
        </button>
      </div>

      <div style={styles.scopeCard}>
        <div style={styles.scopeHeaderRow}>
          <span style={styles.scopeChip}>{model.scopeTypeLabel}</span>
          <span style={styles.scopeLabel} title={model.scopeLabel}>
            {model.scopeLabel}
          </span>
        </div>
        {(model.scopeMeta || model.scopeSelectionLabel) && (
          <div style={styles.scopeMetaRow}>
            {model.scopeMeta && <span style={styles.scopeMeta}>{model.scopeMeta}</span>}
            {model.scopeSelectionLabel && (
              <span style={styles.selectionBadge}>{model.scopeSelectionLabel}</span>
            )}
          </div>
        )}
        {(model.contextAvailabilityLabel || model.contextWarnings.length > 0) && (
          <div style={styles.scopeMetaRow}>
            {model.contextAvailabilityLabel && (
              <span style={styles.contextAvailabilityBadge}>
                {model.contextAvailabilityLabel}
              </span>
            )}
            {model.contextWarnings.length > 0 && (
              <div style={styles.contextWarningList}>
                {model.contextWarnings.map((warning) => (
                  <span key={warning} style={styles.contextWarningBadge}>
                    {warning}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {model.noticeText && (
        <div style={styles.noticeCard}>
          <div style={styles.noticeTitle}>{model.noticeTitle}</div>
          <div style={styles.noticeText}>{model.noticeText}</div>
          <button style={styles.noticeButton} onClick={handleOpenSettings}>
            Open Settings
          </button>
        </div>
      )}

      <div style={styles.content}>
        <section style={styles.heroCard}>
          <div style={styles.heroTitle}>{model.heroTitle}</div>
          <div style={styles.heroBody}>{model.heroBody}</div>
        </section>

        {model.showSuggestedActions && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionTitle}>Suggested actions</div>
            <div style={styles.presetGrid}>
              {model.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  style={styles.presetButton}
                  onClick={() => {
                    void handlePresetSend(action.prompt);
                  }}
                >
                  <span style={styles.presetButtonLabel}>{action.label}</span>
                  <span style={styles.presetButtonDescription}>
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {model.showThreadView && (
          <div style={styles.threadViewWrap}>
            <ThreadView hasScope={scope != null} thread={session.activeThread} />
          </div>
        )}

        {isRecentChatsVisible && (
          <section style={styles.sectionCard}>
            <div style={styles.sectionTitle}>Recent chats</div>
            <div style={styles.recentList}>
              {model.recentThreads.map((thread) => (
                <button
                  key={thread.id}
                  style={styles.recentThreadButton}
                  onClick={() => handleOpenThread(thread)}
                >
                  <span style={styles.recentThreadTitle}>{thread.title}</span>
                  <span style={styles.recentThreadPreview}>
                    {getThreadPreview(thread)}
                  </span>
                  <span style={styles.recentThreadTime}>
                    {formatThreadTimestamp(thread.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {session.isStreaming && session.streamingContent && (
          <div style={styles.streamingCard}>
            <div style={styles.streamingLabel}>AI is responding</div>
            <div style={styles.streamingContent}>{session.streamingContent}</div>
          </div>
        )}

        {session.error && <div style={styles.errorCard}>{session.error}</div>}
      </div>

      <Composer
        onSend={(message) => {
          void handleSend(message);
        }}
        onCancel={handleCancel}
        isStreaming={session.isStreaming}
        currentScopeType={scope?.type || null}
        disabled={model.composerDisabled}
        disabledReason={model.composerDisabledReason}
        placeholder={model.composerPlaceholder}
        draftValue={composerDraft}
        focusNonce={composerFocusNonce}
        onDraftChange={setComposerDraft}
      />
    </div>
  );
};

function getThreadPreview(thread: Thread): string {
  const lastVisibleMessage = [...thread.messages]
    .reverse()
    .find((message) => message.role !== "system");

  if (lastVisibleMessage?.content) {
    return lastVisibleMessage.content.slice(0, 90);
  }

  return thread.scopeSnapshot?.label || "No messages yet";
}

function formatThreadTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return isSameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
}

function summarizeScope(scope: ScopeContext | null): AssembledContext | null {
  if (!scope) {
    return null;
  }

  try {
    return assembleContext(scope);
  } catch (error) {
    ztoolkit.log("Failed to summarize scope context:", error);
    return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background:
      "linear-gradient(180deg, #fffdf7 0%, #fcfaf5 24%, #f7f4ee 100%)",
    color: "#1f2937",
    fontFamily:
      '"SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    minHeight: "0",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 14px 8px",
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8b6b2e",
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#241b0d",
    marginTop: "2px",
  },
  headerMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "6px",
  },
  providerPill: {
    background: "rgba(118, 82, 24, 0.08)",
    color: "#6b4f19",
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 600,
  },
  statusPill: {
    borderRadius: "999px",
    padding: "5px 10px",
    fontSize: "11px",
    fontWeight: 700,
  },
  statusReady: {
    background: "#e8f5e9",
    color: "#1b5e20",
  },
  statusMuted: {
    background: "#f4efe3",
    color: "#7b6841",
  },
  toolbar: {
    display: "flex",
    gap: "8px",
    padding: "0 14px 12px",
  },
  toolbarButton: {
    appearance: "none",
    border: "1px solid rgba(72, 57, 28, 0.15)",
    borderRadius: "10px",
    background: "#fffefb",
    color: "#2f2416",
    padding: "8px 11px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 1px 0 rgba(30, 20, 5, 0.03)",
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  scopeCard: {
    margin: "0 14px",
    padding: "12px",
    borderRadius: "14px",
    border: "1px solid rgba(130, 98, 37, 0.18)",
    background: "rgba(255, 252, 245, 0.95)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.6)",
  },
  scopeHeaderRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  scopeChip: {
    flexShrink: 0,
    background: "#ead8ac",
    color: "#5c4315",
    borderRadius: "999px",
    padding: "4px 9px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  scopeLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#2f2416",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  scopeMetaRow: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
    flexWrap: "wrap",
  },
  scopeMeta: {
    color: "#7a6641",
    fontSize: "12px",
  },
  selectionBadge: {
    color: "#0f766e",
    background: "rgba(15, 118, 110, 0.08)",
    borderRadius: "999px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 700,
  },
  contextAvailabilityBadge: {
    color: "#7c4d0f",
    background: "rgba(214, 174, 72, 0.16)",
    borderRadius: "999px",
    padding: "3px 8px",
    fontSize: "11px",
    fontWeight: 700,
  },
  contextWarningList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    width: "100%",
  },
  contextWarningBadge: {
    color: "#92400e",
    background: "rgba(251, 191, 36, 0.14)",
    border: "1px solid rgba(217, 119, 6, 0.16)",
    borderRadius: "10px",
    padding: "6px 8px",
    fontSize: "11px",
    lineHeight: 1.4,
  },
  content: {
    flex: 1,
    minHeight: "0",
    overflow: "auto",
    padding: "12px 14px 0",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  heroCard: {
    padding: "16px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(252, 242, 211, 0.92) 0%, rgba(255, 255, 255, 0.94) 100%)",
    border: "1px solid rgba(130, 98, 37, 0.14)",
  },
  heroTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#23180d",
  },
  heroBody: {
    marginTop: "8px",
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#5a4a2a",
  },
  sectionCard: {
    padding: "14px",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(130, 98, 37, 0.12)",
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#332615",
    marginBottom: "10px",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
  },
  presetButton: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(130, 98, 37, 0.14)",
    background: "#fffdfa",
    cursor: "pointer",
    textAlign: "left",
  },
  presetButtonLabel: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#2f2416",
  },
  presetButtonDescription: {
    fontSize: "12px",
    color: "#756241",
    lineHeight: 1.5,
  },
  recentList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  recentThreadButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    width: "100%",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(130, 98, 37, 0.14)",
    background: "#fffdfa",
    cursor: "pointer",
    textAlign: "left",
  },
  recentThreadTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#2f2416",
  },
  recentThreadPreview: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#7a6641",
  },
  recentThreadTime: {
    fontSize: "11px",
    color: "#9a8968",
  },
  threadViewWrap: {
    display: "flex",
    flexDirection: "column",
    minHeight: "220px",
    flex: 1,
    borderRadius: "16px",
    border: "1px solid rgba(130, 98, 37, 0.12)",
    background: "rgba(255, 255, 255, 0.82)",
    overflow: "hidden",
  },
  noticeCard: {
    margin: "12px 14px 0",
    padding: "12px",
    borderRadius: "14px",
    background: "#fff7df",
    border: "1px solid #f0d17a",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  noticeTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#8a5a00",
  },
  noticeText: {
    fontSize: "12px",
    lineHeight: 1.5,
    color: "#7a5a10",
  },
  noticeButton: {
    alignSelf: "flex-start",
    padding: "7px 11px",
    borderRadius: "8px",
    border: "1px solid #d9be62",
    background: "#fffef7",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  streamingCard: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "#f8fbff",
    border: "1px solid #d7e8ff",
  },
  streamingLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 700,
    color: "#4477b6",
    marginBottom: "6px",
  },
  streamingContent: {
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#28415f",
    whiteSpace: "pre-wrap",
  },
  errorCard: {
    padding: "12px 14px",
    borderRadius: "16px",
    background: "#fff0f0",
    border: "1px solid #f3b1b1",
    color: "#a12626",
    fontSize: "13px",
    lineHeight: 1.5,
  },
};
