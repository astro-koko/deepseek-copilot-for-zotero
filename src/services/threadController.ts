import type { Thread, Message } from "../types/thread";
import type { ScopeContext } from "../types/scope";
import {
  saveThread,
  loadThread,
  loadAllThreads,
  deletePersistedThread,
} from "./persistence";

export async function createThread(scope?: ScopeContext): Promise<Thread> {
  const now = Date.now();
  const thread: Thread = {
    id: `thread-${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: scope?.label || "New Conversation",
    createdAt: now,
    updatedAt: now,
    scopeKey: getScopeKey(scope),
    scopeSnapshot: scope,
    messages: [],
  };
  await saveThread(thread);
  return thread;
}

export async function appendMessage(
  threadId: string,
  message: Omit<Message, "id" | "timestamp">,
): Promise<Thread | null> {
  const thread = await loadThread(threadId);
  if (!thread) return null;

  const newMessage: Message = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };

  thread.messages.push(newMessage);
  thread.updatedAt = Date.now();

  if (
    thread.title === "New Conversation" &&
    message.role === "user" &&
    message.content
  ) {
    thread.title = message.content.slice(0, 60) + (message.content.length > 60 ? "..." : "");
  }

  await saveThread(thread);
  return thread;
}

export async function recordScopeTransition(
  threadId: string,
  newScope: ScopeContext,
): Promise<Thread | null> {
  const thread = await loadThread(threadId);
  if (!thread) return null;

  if (
    thread.scopeSnapshot?.type === newScope.type &&
    thread.scopeSnapshot?.id === newScope.id
  ) {
    return thread;
  }

  const transitionMessage: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role: "system",
    content: `Context switched to: ${newScope.label}`,
    timestamp: Date.now(),
  };

  thread.messages.push(transitionMessage);
  thread.scopeSnapshot = newScope;
  thread.scopeKey = getScopeKey(newScope);
  thread.updatedAt = Date.now();

  await saveThread(thread);
  return thread;
}

export async function getThread(id: string): Promise<Thread | null> {
  return loadThread(id);
}

export async function listThreads(): Promise<Thread[]> {
  const threads = await loadAllThreads();
  return threads.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getScopeKey(
  scope?: ScopeContext | null,
): string | undefined {
  if (!scope) {
    return undefined;
  }
  return scope.scopeKey || deriveScopeKeyFromSnapshot(scope) || scope.id;
}

export function getThreadScopeKey(thread: Thread): string | undefined {
  return (
    thread.scopeKey ||
    deriveScopeKeyFromSnapshot(thread.scopeSnapshot) ||
    thread.scopeSnapshot?.id
  );
}

export function threadMatchesScope(
  thread: Thread,
  scope?: ScopeContext | null,
): boolean {
  const scopeKey = getScopeKey(scope);
  if (!scopeKey) {
    return false;
  }
  return getThreadScopeKey(thread) === scopeKey;
}

export async function listThreadsForScope(
  scope: ScopeContext,
  limit = 5,
): Promise<Thread[]> {
  const threads = await listThreads();
  return threads.filter((thread) => threadMatchesScope(thread, scope)).slice(0, limit);
}

export async function findMostRecentThreadForScope(
  scope: ScopeContext,
): Promise<Thread | null> {
  return (await listThreadsForScope(scope, 1))[0] ?? null;
}

export async function deleteThread(id: string): Promise<boolean> {
  return deletePersistedThread(id);
}

function deriveScopeKeyFromSnapshot(
  scope?: ScopeContext | null,
): string | undefined {
  if (!scope) {
    return undefined;
  }
  if (scope.scopeKey) {
    return scope.scopeKey;
  }
  if (scope.type === "pdf" && scope.readerAttachmentId) {
    return `pdf-${scope.readerAttachmentId}`;
  }
  if (scope.type === "paper" && scope.itemIds.length === 1) {
    return `paper-${scope.itemIds[0]}`;
  }
  return undefined;
}
