import React, { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Composer } from "./Composer";
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
  getEvidenceSettingsIssue,
  getSettings,
  getSettingsIssue,
  saveSettings,
} from "../../services/settingsManager";
import { chatSessionStore } from "../../services/chatSession";
import { deleteThread, listThreads } from "../../services/threadController";
import { exportThreadAsMarkdown } from "../../services/threadExport";
import { deleteThreadAndRefresh } from "../../services/threadActions";
import { getSidebarTheme } from "../theme";
import { typography } from "../typography";
import { isChineseLocale } from "../../utils/locale";

interface SidebarProps {
  eventBus: EventTarget;
  hostWindow: Window;
  location: "library" | "reader";
}

const LazyThreadView = React.lazy(async () => ({
  default: (await import("./ThreadView")).ThreadView,
}));

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
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);
  const zh = isChineseLocale();

  const syncResolvedScope = () => {
    const currentScope = getCurrentScope();
    setScope(currentScope);
    void refreshContextSummary(currentScope);
    void chatSessionStore.syncScope(currentScope);
  };

  const refreshContextSummary = async (nextScope: ScopeContext | null) => {
    const summary = await summarizeScope(nextScope);
    setContextSummary(summary);
  };

  useEffect(() => {
    const refreshSettings = () => {
      setSettings(getSettings());
      if (location === "reader") {
        syncResolvedScope();
      }
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
    const mediaQuery = hostWindow.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) {
      return;
    }

    const handleThemeChange = () => {
      setThemeRefreshKey((value) => value + 1);
    };

    mediaQuery.addEventListener?.("change", handleThemeChange);
    mediaQuery.addListener?.(handleThemeChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleThemeChange);
      mediaQuery.removeListener?.(handleThemeChange);
    };
  }, [hostWindow]);

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
      void refreshContextSummary(nextScope);
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
      void refreshContextSummary(currentScope);

      void (async () => {
        if (!isSupportedChatScope(currentScope)) {
          return;
        }

        await chatSessionStore.syncScope(currentScope);
        setShowRecentChats(false);

        if (detail.action === "explain") {
          setComposerDraft("");
          await chatSessionStore.send(prompt, currentScope, {
            evidenceEnabled: settings.evidenceEnabled && !getEvidenceSettingsIssue(settings),
          });
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
  }, [eventBus, location, settings]);

  useEffect(() => {
    syncResolvedScope();

    if (location !== "reader") {
      return;
    }

    const retry = hostWindow.setTimeout(() => {
      syncResolvedScope();
    }, 150);

    return () => {
      hostWindow.clearTimeout(retry);
    };
  }, [hostWindow, location]);

  const handleNewThread = async () => {
    const currentScope = getCurrentScope();
    setScope(currentScope);
    await refreshContextSummary(currentScope);
    if (!isSupportedChatScope(currentScope)) {
      return;
    }
    await chatSessionStore.newThread(currentScope);
    setComposerDraft("");
    setShowRecentChats(false);
  };

  const evidenceIssue = getEvidenceSettingsIssue(settings);
  const evidenceEnabled =
    settings.evidenceEnabled && !evidenceIssue;

  const handleSend = async (userInput: string) => {
    if (!isSupportedChatScope(scope)) {
      return;
    }

    try {
      await chatSessionStore.send(userInput, scope, {
        evidenceEnabled,
      });
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

  const handleDeleteThread = async (thread: Thread) => {
    try {
      const result = await deleteThreadAndRefresh({
        activeThread: session.activeThread,
        deleteThread,
        listThreads,
        resetSession: () => chatSessionStore.reset(),
        threadId: thread.id,
      });
      setRecentThreads(result.recentThreads);
      setShowRecentChats(result.recentThreads.length > 0);
    } catch (error) {
      ztoolkit.log("Failed to delete thread:", error);
    }
  };

  const handleExportThread = async (thread: Thread) => {
    try {
      const safeTitle = thread.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "thread";
      const outputPath = `/tmp/ds-copilot-${safeTitle}-${thread.id}.md`;
      await exportThreadAsMarkdown(thread, outputPath);
    } catch (error) {
      ztoolkit.log("Failed to export thread:", error);
    }
  };

  const handleModelChange = (model: "deepseek-v4-flash" | "deepseek-v4-pro") => {
    saveSettings({ model });
    setSettings(getSettings());
    eventBus.dispatchEvent(new Event("settingsChange"));
  };

  const handleToggleEvidence = () => {
    saveSettings({ evidenceEnabled: !settings.evidenceEnabled });
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
  const theme = getSidebarTheme(hostWindow);
  const evidenceLabel =
    evidenceIssue
      ? zh
        ? "联网查证（配置 Tavily）"
        : "Web Verification (Configure Tavily)"
      : zh
        ? "联网查证"
        : "Web Verification";

  return (
    <div
      key={themeRefreshKey}
      style={{ ...styles.container, background: theme.background, color: theme.text }}
    >
      <div style={{ ...styles.header, background: theme.background, borderBottomColor: theme.border }}>
        <div style={styles.headerMain}>
          <div style={{ ...styles.headerTitle, color: theme.text }}>DS Copilot</div>
          <div style={{ ...styles.headerMeta, color: theme.mutedText }}>
            {model.locationLabel} · {model.providerLabel} · {model.statusLabel}
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            style={{
              ...styles.toolbarButton,
              color: theme.buttonText,
              borderColor: theme.buttonBorder,
              ...(isSupportedChatScope(scope) ? null : styles.toolbarButtonDisabled),
            }}
            onClick={() => {
              void handleNewThread();
            }}
            disabled={!isSupportedChatScope(scope) || session.isStreaming}
          >
            {model.newThreadLabel}
          </button>
          <button
            style={{
              ...styles.toolbarButton,
              color: theme.buttonText,
              borderColor: theme.buttonBorder,
              ...(model.recentThreads.length > 0 ? null : styles.toolbarButtonDisabled),
            }}
            onClick={() => setShowRecentChats((current) => !current)}
            disabled={model.recentThreads.length === 0}
          >
            {model.recentThreadsLabel}
          </button>
          <button
            style={{ ...styles.toolbarButton, color: theme.buttonText, borderColor: theme.buttonBorder }}
            onClick={handleOpenSettings}
          >
            {model.settingsLabel}
          </button>
        </div>
      </div>

      <div style={{ ...styles.scopeSection, background: theme.background, borderBottomColor: theme.softBorder }}>
        <div style={{ ...styles.sectionLabel, color: theme.mutedText }}>{model.scopeSectionLabel}</div>
        <div style={styles.scopeHeaderRow}>
          <span style={{ ...styles.scopeType, color: theme.mutedText }}>{model.scopeTypeLabel}</span>
          <span style={{ ...styles.scopeLabel, color: theme.text }} title={model.scopeLabel}>
            {model.scopeLabel}
          </span>
        </div>
        {(model.scopeMeta || model.scopeSelectionLabel) && (
          <div style={styles.scopeMetaRow}>
            {model.scopeMeta && <span style={{ ...styles.scopeMeta, color: theme.mutedText }}>{model.scopeMeta}</span>}
            {model.scopeSelectionLabel && (
              <span
                style={{
                  ...styles.selectionBadge,
                  color: theme.badgeText,
                  background: theme.badgeBackground,
                  borderColor: theme.badgeBorder,
                }}
              >
                {model.scopeSelectionLabel}
              </span>
            )}
          </div>
        )}
        {(model.contextAvailabilityLabel || model.contextWarnings.length > 0) && (
          <div style={styles.scopeMetaRow}>
            {model.contextAvailabilityLabel && (
              <span
                style={{
                  ...styles.contextAvailabilityBadge,
                  color: theme.accentText,
                  background: theme.accentBackground,
                  borderColor: theme.accentBorder,
                }}
              >
                {model.contextAvailabilityLabel}
              </span>
            )}
            {model.contextWarnings.length > 0 && (
              <div style={styles.contextWarningList}>
                {model.contextWarnings.map((warning) => (
                  <span
                    key={warning}
                    style={{
                      ...styles.contextWarningBadge,
                      color: theme.warningText,
                      background: theme.warningBackground,
                      borderColor: theme.warningBorder,
                    }}
                  >
                    {warning}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {model.noticeText && (
        <div style={{ ...styles.noticeSection, background: theme.noticeBackground, borderBottomColor: theme.noticeBorder }}>
          <div style={{ ...styles.noticeTitle, color: theme.noticeTitle }}>{model.noticeTitle}</div>
          <div style={{ ...styles.noticeText, color: theme.noticeText }}>{model.noticeText}</div>
          <button
            style={{
              ...styles.noticeButton,
              color: theme.buttonText,
              background: theme.surfaceBackground,
              borderColor: theme.noticeBorder,
            }}
            onClick={handleOpenSettings}
          >
            {model.openSettingsLabel}
          </button>
        </div>
      )}

      <div style={styles.content}>
        <section style={styles.introSection}>
          <div style={{ ...styles.sectionLabel, color: theme.mutedText }}>{model.chatSectionLabel}</div>
          <div style={{ ...styles.heroTitle, color: theme.text }}>{model.heroTitle}</div>
          <div style={{ ...styles.heroBody, color: theme.mutedText }}>{model.heroBody}</div>
        </section>

        {session.activeThread && (
          <section style={{ ...styles.section, borderTopColor: theme.softBorder }}>
            <div style={{ ...styles.sectionTitle, color: theme.text }}>
              {zh ? "会话操作" : "Conversation actions"}
            </div>
            <div style={styles.threadActionRow}>
              <button
                style={{ ...styles.threadActionButton, color: theme.buttonText, borderColor: theme.buttonBorder }}
                onClick={() => {
                  void handleExportThread(session.activeThread!);
                }}
              >
                {zh ? "导出当前会话" : "Export current thread"}
              </button>
              <button
                style={{ ...styles.threadActionButton, color: theme.errorText, borderColor: theme.errorBorder }}
                onClick={() => {
                  void handleDeleteThread(session.activeThread!);
                }}
              >
                {zh ? "删除当前会话" : "Delete current thread"}
              </button>
            </div>
          </section>
        )}

        {model.showSuggestedActions && (
          <section style={{ ...styles.section, borderTopColor: theme.softBorder }}>
            <div style={{ ...styles.sectionTitle, color: theme.text }}>{model.suggestedActionsLabel}</div>
            <div
              style={{
                ...styles.suggestedActionsGrid,
                borderTopColor: theme.border,
                borderBottomColor: theme.border,
                background: theme.border,
              }}
            >
              {model.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  style={{ ...styles.suggestedActionButton, background: theme.surfaceBackground }}
                  onClick={() => {
                    void handlePresetSend(action.prompt);
                  }}
                >
                  <span style={styles.listRow}>
                    <span style={{ ...styles.listPrimary, color: theme.text }}>{action.label}</span>
                    <span style={{ ...styles.listSecondary, color: theme.mutedText }}>
                      {action.description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {model.showThreadView && (
          <div style={{ ...styles.threadSection, borderTopColor: theme.softBorder }}>
            <Suspense fallback={null}>
              <LazyThreadView hasScope={scope != null} thread={session.activeThread} />
            </Suspense>
          </div>
        )}

        {isRecentChatsVisible && (
          <section style={{ ...styles.section, borderTopColor: theme.softBorder }}>
            <div style={{ ...styles.sectionTitle, color: theme.text }}>{model.recentThreadsLabel}</div>
            <div style={{ ...styles.list, borderTopColor: theme.border, borderBottomColor: theme.border, background: theme.border }}>
              {model.recentThreads.map((thread) => (
                <div
                  key={thread.id}
                  style={{ ...styles.listButton, background: theme.surfaceBackground }}
                >
                  <button
                    style={styles.threadMainButton}
                    onClick={() => handleOpenThread(thread)}
                  >
                    <span style={styles.listRow}>
                      <span style={{ ...styles.listPrimary, color: theme.text }}>{thread.title}</span>
                      <span style={{ ...styles.listSecondary, color: theme.mutedText }}>
                        {getThreadPreview(thread)}
                      </span>
                    </span>
                  </button>
                  <div style={styles.threadMetaRow}>
                    <span style={{ ...styles.listMeta, color: theme.mutedText }}>
                      {formatThreadTimestamp(thread.updatedAt)}
                    </span>
                  </div>
                  <div style={styles.threadActionRow}>
                    <button
                      style={{ ...styles.threadActionButton, color: theme.buttonText, borderColor: theme.buttonBorder }}
                      onClick={() => {
                        void handleExportThread(thread);
                      }}
                    >
                      {zh ? "导出" : "Export"}
                    </button>
                    <button
                      style={{ ...styles.threadActionButton, color: theme.errorText, borderColor: theme.errorBorder }}
                      onClick={() => {
                        void handleDeleteThread(thread);
                      }}
                    >
                      {zh ? "删除" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {session.isStreaming && session.streamingContent && (
          <div style={{ ...styles.streamingSection, background: theme.panelBackground, borderTopColor: theme.softBorder, borderBottomColor: theme.softBorder }}>
            <div style={{ ...styles.streamingLabel, color: theme.mutedText }}>{model.streamingLabel}</div>
            <div style={{ ...styles.streamingContent, color: theme.text }}>{session.streamingContent}</div>
          </div>
        )}

        {session.error && (
          <div
            style={{
              ...styles.errorSection,
              background: theme.errorBackground,
              borderTopColor: theme.errorBorder,
              borderBottomColor: theme.errorBorder,
              color: theme.errorText,
            }}
          >
            {session.error}
          </div>
        )}
      </div>

      <Composer
        onSend={(message) => {
          void handleSend(message);
        }}
        onCancel={handleCancel}
        onModelModeChange={(mode) =>
          handleModelChange(mode === "deep" ? "deepseek-v4-pro" : "deepseek-v4-flash")
        }
        onToggleEvidence={handleToggleEvidence}
        isStreaming={session.isStreaming}
        currentScopeType={scope?.type || null}
        disabled={model.composerDisabled}
        disabledReason={model.composerDisabledReason}
        placeholder={model.composerPlaceholder}
        draftValue={composerDraft}
        focusNonce={composerFocusNonce}
        modelMode={settings.model === "deepseek-v4-pro" ? "deep" : "light"}
        evidenceDisabled={Boolean(evidenceIssue)}
        evidenceEnabled={evidenceEnabled}
        evidenceLabel={evidenceLabel}
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

  return thread.scopeSnapshot?.label || "暂无消息";
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

async function summarizeScope(scope: ScopeContext | null): Promise<AssembledContext | null> {
  if (!scope) {
    return null;
  }

  try {
    return await assembleContext(scope);
  } catch (error) {
    ztoolkit.log("Failed to summarize scope context:", error);
    return null;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "auto",
    background: "#f7f7f7",
    color: "#222",
    minHeight: "0",
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
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
    flex: "1 1 130px",
  },
  headerTitle: {
    fontSize: typography.headingSm,
    fontWeight: 600,
    color: "#222",
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    overflowWrap: "anywhere",
  },
  headerMeta: {
    fontSize: typography.caption,
    color: "#666",
    overflow: "hidden",
    textOverflow: "ellipsis",
    overflowWrap: "anywhere",
  },
  headerActions: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    minWidth: 0,
    flex: "1 1 170px",
  },
  toolbarButton: {
    appearance: "none",
    border: "1px solid #c9c9c9",
    borderRadius: "4px",
    background: "transparent",
    color: "#333",
    padding: "3px 6px",
    fontSize: typography.label,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  toolbarButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  scopeSection: {
    padding: "8px 10px",
    borderBottom: "1px solid #e0e0e0",
    background: "#f7f7f7",
    minWidth: 0,
  },
  sectionLabel: {
    fontSize: typography.caption,
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
    flexWrap: "wrap",
  },
  scopeType: {
    flexShrink: 0,
    color: "#666",
    fontSize: typography.label,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  scopeLabel: {
    minWidth: 0,
    flex: 1,
    fontSize: typography.body,
    fontWeight: 600,
    color: "#222",
    overflow: "hidden",
    textOverflow: "ellipsis",
    overflowWrap: "anywhere",
  },
  scopeMetaRow: {
    display: "flex",
    gap: "8px",
    marginTop: "6px",
    flexWrap: "wrap",
  },
  scopeMeta: {
    color: "#666",
    fontSize: typography.meta,
  },
  selectionBadge: {
    color: "#2a5a86",
    background: "#edf4fb",
    border: "1px solid #d6e5f4",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: typography.label,
    fontWeight: 500,
  },
  contextAvailabilityBadge: {
    color: "#6d5a1f",
    background: "#f7f1dc",
    border: "1px solid #e7dfc3",
    borderRadius: "4px",
    padding: "1px 6px",
    fontSize: typography.label,
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
    fontSize: typography.meta,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
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
    fontSize: typography.body,
    fontWeight: 600,
    color: "#5d4d23",
  },
  noticeText: {
    fontSize: typography.meta,
    lineHeight: 1.4,
    color: "#6f6138",
    overflowWrap: "anywhere",
  },
  noticeButton: {
    alignSelf: "flex-start",
    padding: "4px 8px",
    borderRadius: "4px",
    border: "1px solid #d4c8a5",
    background: "#fffdf8",
    cursor: "pointer",
    fontSize: typography.label,
    fontWeight: 500,
  },
  content: {
    flex: "none",
    minHeight: "auto",
    overflow: "visible",
    padding: "8px 10px 0",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    boxSizing: "border-box",
  },
  introSection: {
    padding: "8px 0 2px",
  },
  heroTitle: {
    fontSize: typography.headingSm,
    fontWeight: 600,
    color: "#222",
  },
  heroBody: {
    marginTop: "4px",
    fontSize: typography.body,
    lineHeight: 1.45,
    color: "#666",
    overflowWrap: "anywhere",
  },
  section: {
    borderTop: "1px solid #e2e2e2",
    paddingTop: "8px",
  },
  sectionTitle: {
    fontSize: typography.body,
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
  suggestedActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "1px",
    borderTop: "1px solid #dddddd",
    borderBottom: "1px solid #dddddd",
    overflow: "hidden",
    background: "#dddddd",
  },
  suggestedActionButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "4px",
    width: "100%",
    minWidth: 0,
    padding: "8px 10px",
    border: "none",
    background: "#fff",
    textAlign: "left",
  },
  listButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "6px",
    width: "100%",
    padding: "8px 10px",
    border: "none",
    background: "#fff",
    textAlign: "left",
    minWidth: 0,
  },
  threadMainButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "4px",
    width: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    minWidth: 0,
  },
  threadActionRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "6px",
    width: "100%",
    minWidth: 0,
  },
  threadActionButton: {
    appearance: "none",
    border: "1px solid #c9c9c9",
    borderRadius: "4px",
    background: "transparent",
    padding: "2px 8px",
    fontSize: typography.label,
    cursor: "pointer",
    whiteSpace: "normal",
    lineHeight: 1.3,
    width: "100%",
    minWidth: 0,
    textAlign: "center",
    boxSizing: "border-box",
  },
  listRow: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  listPrimary: {
    fontSize: typography.body,
    fontWeight: 500,
    lineHeight: 1.35,
    color: "#222",
    display: "block",
    maxHeight: "2.7em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    overflowWrap: "anywhere",
  },
  listSecondary: {
    fontSize: typography.meta,
    lineHeight: 1.35,
    color: "#666",
    display: "block",
    maxHeight: "2.7em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    overflowWrap: "anywhere",
  },
  listMeta: {
    fontSize: typography.meta,
    color: "#777",
    flexShrink: 0,
  },
  threadMetaRow: {
    display: "flex",
    justifyContent: "flex-end",
    minWidth: 0,
    marginBottom: "4px",
  },
  threadSection: {
    display: "block",
    minHeight: "180px",
    flex: "none",
    borderTop: "1px solid #e2e2e2",
    paddingTop: "8px",
    overflow: "visible",
    minWidth: 0,
  },
  streamingSection: {
    padding: "8px 10px",
    borderTop: "1px solid #d9e3ef",
    borderBottom: "1px solid #d9e3ef",
    background: "#f7f9fb",
  },
  streamingLabel: {
    fontSize: typography.label,
    fontWeight: 600,
    color: "#4f6b8a",
    marginBottom: "4px",
  },
  streamingContent: {
    fontSize: typography.body,
    lineHeight: 1.45,
    color: "#33485f",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  errorSection: {
    padding: "8px 10px",
    background: "#fbf1f1",
    borderTop: "1px solid #ead2d2",
    borderBottom: "1px solid #ead2d2",
    color: "#8d3838",
    fontSize: typography.body,
    lineHeight: 1.4,
    overflowWrap: "anywhere",
  },
};
