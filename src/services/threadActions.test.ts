import { describe, expect, it, vi } from "vitest";

import type { Thread } from "../types/thread";
import { deleteThreadAndRefresh } from "./threadActions";

function makeThread(id: string, title: string): Thread {
  return {
    id,
    title,
    createdAt: 1,
    updatedAt: 1,
    messages: [],
  };
}

describe("threadActions", () => {
  it("deletes a thread, reloads recent threads, and clears the active thread when it was deleted", async () => {
    const activeThread = makeThread("thread-1", "Current");
    const remainingThread = makeThread("thread-2", "Other");
    const deleteThread = vi.fn().mockResolvedValue(true);
    const listThreads = vi.fn().mockResolvedValue([remainingThread]);
    const resetSession = vi.fn();

    const result = await deleteThreadAndRefresh({
      activeThread,
      deleteThread,
      listThreads,
      resetSession,
      threadId: activeThread.id,
    });

    expect(deleteThread).toHaveBeenCalledWith("thread-1");
    expect(listThreads).toHaveBeenCalledTimes(1);
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      deleted: true,
      recentThreads: [remainingThread],
    });
  });
});
