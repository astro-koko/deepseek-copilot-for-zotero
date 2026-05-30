import type { Thread, Message } from "../types/thread";
import type { ScopeContext } from "../types/scope";
import {
  saveThread,
  loadThread,
  loadAllThreads,
  deletePersistedThread,
} from "./persistence";

export function createThread(scope?: ScopeContext): Thread {
  const now = Date.now();
  const thread: Thread = {
    id: `thread-${now}-${Math.random().toString(36).slice(2, 9)}`,
    title: scope?.label || "New Conversation",
    createdAt: now,
    updatedAt: now,
    scopeSnapshot: scope,
    messages: [],
  };
  saveThread(thread);
  return thread;
}

export function appendMessage(
  threadId: string,
  message: Omit<Message, "id" | "timestamp">,
): Thread | null {
  const thread = loadThread(threadId);
  if (!thread) return null;

  const newMessage: Message = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };

  thread.messages.push(newMessage);
  thread.updatedAt = Date.now();

  // Auto-title from first user message
  if (
    thread.title === "New Conversation" &&
    message.role === "user" &&
    message.content
  ) {
    thread.title = message.content.slice(0, 60) + (message.content.length > 60 ? "..." : "");
  }

  saveThread(thread);
  return thread;
}

export function recordScopeTransition(
  threadId: string,
  newScope: ScopeContext,
): Thread | null {
  const thread = loadThread(threadId);
  if (!thread) return null;

  // Only record if scope actually changed
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
  thread.updatedAt = Date.now();

  saveThread(thread);
  return thread;
}

export function getThread(id: string): Thread | null {
  return loadThread(id);
}

export function listThreads(): Thread[] {
  return loadAllThreads().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteThread(id: string): boolean {
  return deletePersistedThread(id);
}
