import type { Thread } from "../types/thread";

interface DeleteThreadAndRefreshArgs {
  activeThread: Thread | null;
  deleteThread: (id: string) => Promise<boolean>;
  listThreads: () => Promise<Thread[]>;
  resetSession: () => void;
  threadId: string;
}

export async function deleteThreadAndRefresh({
  activeThread,
  deleteThread,
  listThreads,
  resetSession,
  threadId,
}: DeleteThreadAndRefreshArgs): Promise<{
  deleted: boolean;
  recentThreads: Thread[];
}> {
  const deleted = await deleteThread(threadId);
  if (deleted && activeThread?.id === threadId) {
    resetSession();
  }

  return {
    deleted,
    recentThreads: await listThreads(),
  };
}

