import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeDatabase,
  initDatabase,
  loadAllThreads,
  loadThread,
  saveThread,
} from "./persistence";
import type { Thread } from "../types/thread";

const queryAsync = vi.fn();
const execTransaction = vi.fn(async (callback: (conn: { queryAsync: typeof queryAsync }) => unknown) =>
  callback({ queryAsync }),
);

describe("persistence", () => {
  beforeEach(async () => {
    await closeDatabase();
    queryAsync.mockReset();
    execTransaction.mockClear();
    execTransaction.mockImplementation(
      async (callback: (conn: { queryAsync: typeof queryAsync }) => unknown) =>
        callback({ queryAsync }),
    );

    vi.stubGlobal("Zotero", {
      DB: {
        queryAsync,
        executeTransaction: execTransaction,
      },
    });
    vi.stubGlobal("ztoolkit", {
      log: vi.fn(),
    });
  });

  it("initializes schema through Zotero.DB", async () => {
    await initDatabase();

    expect(execTransaction).toHaveBeenCalledTimes(1);
    expect(queryAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS threads"),
    );
  });

  it("persists and reloads threads through Zotero.DB queryAsync", async () => {
    const thread: Thread = {
      id: "thread-1",
      title: "Thread 1",
      createdAt: 1,
      updatedAt: 2,
      scopeSnapshot: {
        type: "paper",
        id: "paper-1",
        label: "Paper 1",
        itemIds: [1],
      },
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          timestamp: 2,
        },
      ],
    };

    queryAsync.mockResolvedValueOnce(undefined);
    await saveThread(thread);

    expect(queryAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT OR REPLACE INTO threads"),
      [
        "thread-1",
        "Thread 1",
        1,
        2,
        JSON.stringify(thread.scopeSnapshot),
        JSON.stringify(thread.messages),
      ],
    );

    queryAsync.mockResolvedValueOnce([
      {
        id: "thread-1",
        title: "Thread 1",
        createdAt: 1,
        updatedAt: 2,
        scopeSnapshot: JSON.stringify(thread.scopeSnapshot),
        messages: JSON.stringify(thread.messages),
      },
    ]);

    await expect(loadThread("thread-1")).resolves.toEqual(thread);
  });

  it("loads all stored threads", async () => {
    queryAsync
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([
      {
        id: "thread-2",
        title: "Thread 2",
        createdAt: 3,
        updatedAt: 4,
        scopeSnapshot: null,
        messages: "[]",
      },
    ]);

    await expect(loadAllThreads()).resolves.toEqual([
      {
        id: "thread-2",
        title: "Thread 2",
        createdAt: 3,
        updatedAt: 4,
        scopeSnapshot: undefined,
        messages: [],
      },
    ]);
  });

  it("throws when thread persistence fails so callers can surface the real error", async () => {
    const thread: Thread = {
      id: "thread-1",
      title: "Thread 1",
      createdAt: 1,
      updatedAt: 2,
      scopeSnapshot: undefined,
      messages: [],
    };

    queryAsync.mockRejectedValueOnce(new Error("db write failed"));

    await expect(saveThread(thread)).rejects.toThrow("db write failed");
  });
});
