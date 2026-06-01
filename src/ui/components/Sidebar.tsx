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
  saveSettings,
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

  const handleModelChange = (modelName: "deepseek-v4-flash" | "deepseek-v4-pro") => {
    saveSettings({ model: modelName });
    setSettings(getSettings());
    eventBus.dispatchEvent(new Event("settingsChange"));
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
        <div style={styles.headerMain}>
          <div style={styles.headerTitle}>DS Copilot</div>
          <div style={styles.headerMeta}>
            {model.locationLabel} · {model.providerLabel} · {model.statusLabel}
          </div>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.modelToggle} role="group" aria-label="Model selection">
            <button
              style={{
                ...styles.modelToggleButton,
                ...(settings.model === "deepseek-v4-flash"
                  ? styles.modelToggleButtonActive
                  : null),
              }}
              onClick={() => handleModelChange("deepseek-v4-flash")}
            >
              Light
            </button>
            <button
              style={{
                ...styles.modelToggleButton,
                ...(settings.model === "deepseek-v4-pro"
                  ? styles.modelToggleButtonActive
                  : null),
              }}
              onClick={() => handleModelChange("deepseek-v4-pro")}
            >
              Deep
            </button>
          </div>
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
      </div>

      <div style={styles.scopeSection}>
        <div style={styles.sectionLabel}>Context</div>
        <div style={styles.scopeHeaderRow}>
          <span style={styles.scopeType}>{model.scopeTypeLabel}</span>
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
        <div style={styles.noticeSection}>
          <div style={styles.noticeTitle}>{model.noticeTitle}</div>
          <div style={styles.noticeText}>{model.noticeText}</div>
          <button style={styles.noticeButton} onClick={handleOpenSettings}>
            Open Settings
          </button>
        </div>
      )}

      <div style={styles.content}>
        <section style={styles.introSection}>
          <div style={styles.sectionLabel}>Chat</div>
          <div style={styles.heroTitle}>{model.heroTitle}</div>
          <div style={styles.heroBody}>{model.heroBody}</div>
        </section>

        {model.showSuggestedActions && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Suggested actions</div>
            <div style={styles.list}>
              {model.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  style={styles.listButton}
                  onClick={() => {
                    void handlePresetSend(action.prompt);
                  }}
                >
                  <span style={styles.listRow}>
                    <span style={styles.listPrimary}>{action.label}</span>
                    <span style={styles.listSecondary}>
                      {action.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {model.showThreadView && (
          <div style={styles.threadSection}>
            <ThreadView hasScope={scope != null} thread={session.activeThread} />
          </div>
        )}

        {isRecentChatsVisible && (
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Recent chats</div>
            <div style={styles.list}>
              {model.recentThreads.map((thread) => (
                <button
                  key={thread.id}
                  style={styles.listButton}
                  onClick={() => handleOpenThread(thread)}
                >
                  <span style={styles.listRow}>
                    <span style={styles.listPrimary}>{thread.title}</span>
                    <span style={styles.listSecondary}>
                      {getThreadPreview(thread)}
                    </span>
                  </span>
                  <span style={styles.listMeta}>
                    {formatThreadTimestamp(thread.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {session.isStreaming && session.streamingContent && (
          <div style={styles.streamingSection}>
            <div style={styles.streamingLabel}>Responding</div>
            <div style={styles.streamingContent}>{session.streamingContent}</div>
          </div>
        )}

        {session.error && <div style={styles.errorSection}>{session.error}</div>}
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
    background: "#f7f7f7",
    color: "#222",
    fontFamily:
      '"SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    minHeight: "0",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
    padding: "8px 10px",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #d7d7d7",
    background: "#f7f7f7",
  },
  headerMain: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  headerTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#222",
  },
  headerMeta: {
    fontSize: "11px",
    color: "#666",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  headerActions: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
  },
  modelToggle: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #c9c9c9",
    borderRadius: "4px",
    overflow: "hidden",
    background: "#fbfbfb",
  },
  modelToggleButton: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "#555",
    padding: "3px 6px",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
  },
  modelToggleButtonActive: {
    background: "#eeeeee",
    color: "#222",
  },
  toolbarButton: {
    appearance: "none",
    border: "1px solid #c9c9c9",
    borderRadius: "4px",
    background: "transparent",
    color: "#333",
    padding: "3px 6px",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  scopeSection: {
    padding: "8px 10px",
    borderBottom: "1px solid #e0e0e0",
    background: "#f7f7f7",
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#7a7a7a",
    marginBottom: "4px",
  },
  scopeHeaderRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    minWidth: 0,
  },
  scopeType: {
    flexShrink: 0,
    color: "#666",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  scopeLabel: {
    minWidth: 0,
    flex: 1,
    fontSize: "12px",
    fontWeight: 600,
    color: "#222",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  scopeMetaRow: {
    display: "flex",
    gap: "8px",
    marginTop: "6px",
    flexWrap: "wrap",
  },
  scopeMeta: {
    color: "#666",
    fontSize: "11px",
  },
  selectionBadge: {
    color: "#2a5a86",
    background: "#edf4fb",
    border: "1px solid #d6e5f4",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: "11px",
    fontWeight: 500,
  },
  contextAvailabilityBadge: {
    color: "#6d5a1f",
    background: "#f7f1dc",
    border: "1px solid #e7dfc3",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: "11px",
    fontWeight: 500,
  },
  contextWarningList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "100%",
  },
  contextWarningBadge: {
    color: "#7b5d17",
    background: "#f7f3e6",
    border: "1px solid #e5dcc0",
    borderRadius: "4px",
    padding: "5px 6px",
    fontSize: "11px",
    lineHeight: 1.4,
  },
  noticeSection: {
    margin: "0",
    padding: "8px 10px",
    borderBottom: "1px solid #e4dac0",
    background: "#faf7ef",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  noticeTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#5d4d23",
  },
  noticeText: {
    fontSize: "11px",
    lineHeight: 1.4,
    color: "#6f6138",
  },
  noticeButton: {
    alignSelf: "flex-start",
    padding: "4px 8px",
    borderRadius: "4px",
    border: "1px solid #d4c8a5",
    background: "#fffdf8",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 500,
  },
  content: {
    flex: 1,
    minHeight: "0",
    overflow: "auto",
    padding: "8px 10px 0",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  introSection: {
    padding: "8px 0 2px",
  },
  heroTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#222",
  },
  heroBody: {
    marginTop: "4px",
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#666",
  },
  section: {
    borderTop: "1px solid #e2e2e2",
    paddingTop: "8px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#333",
    marginBottom: "6px",
  },
  list: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "1px",
    borderTop: "1px solid #dddddd",
    borderBottom: "1px solid #dddddd",
    overflow: "hidden",
    background: "#dddddd",
  },
  listButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "4px",
    width: "100%",
    padding: "8px 10px",
    border: "none",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
  },
  listRow: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  listPrimary: {
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    color: "#222",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  listSecondary: {
    fontSize: "11px",
    lineHeight: 1.35,
    color: "#666",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  listMeta: {
    fontSize: "11px",
    color: "#777",
    alignSelf: "flex-end",
    flexShrink: 0,
  },
  threadSection: {
    display: "flex",
    flexDirection: "column",
    minHeight: "180px",
    flex: 1,
    borderTop: "1px solid #e2e2e2",
    paddingTop: "8px",
    overflow: "hidden",
  },
  streamingSection: {
    padding: "8px 10px",
    borderTop: "1px solid #d9e3ef",
    borderBottom: "1px solid #d9e3ef",
    background: "#f7f9fb",
  },
  streamingLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#4f6b8a",
    marginBottom: "4px",
  },
  streamingContent: {
    fontSize: "12px",
    lineHeight: 1.45,
    color: "#33485f",
    whiteSpace: "pre-wrap",
  },
  errorSection: {
    padding: "8px 10px",
    background: "#fbf1f1",
    borderTop: "1px solid #ead2d2",
    borderBottom: "1px solid #ead2d2",
    color: "#8d3838",
    fontSize: "12px",
    lineHeight: 1.4,
  },
};
