import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScopeContext } from "../types/scope";
import type { Thread } from "../types/thread";
import {
  createThread,
  findMostRecentThreadForScope,
  listThreadsForScope,
  threadMatchesScope,
} from "./threadController";
import { loadAllThreads, saveThread } from "./persistence";

vi.mock("./persistence", () => ({
  deletePersistedThread: vi.fn(),
  loadAllThreads: vi.fn(),
  loadThread: vi.fn(),
  saveThread: vi.fn(),
}));

function makeScope(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return {
    type: "pdf",
    id: "pdf-2",
    scopeKey: "pdf-2",
    label: "PDF 2",
    itemIds: [1],
    readerAttachmentId: 2,
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: "thread-1",
    title: "Thread 1",
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    ...overrides,
  };
}

describe("threadController", () => {
  beforeEach(() => {
    vi.mocked(loadAllThreads).mockReset();
    vi.mocked(saveThread).mockReset();
  });

  it("sets the current scope key when creating a thread", async () => {
    const scope = makeScope();
    vi.mocked(saveThread).mockResolvedValue(undefined);

    const thread = await createThread(scope);

    expect(thread.scopeKey).toBe("pdf-2");
    expect(thread.scopeSnapshot).toBe(scope);
    expect(saveThread).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeKey: "pdf-2",
        scopeSnapshot: scope,
      }),
    );
  });

  it("matches threads by stored scopeKey or legacy scope snapshot", () => {
    const scope = makeScope();

    expect(threadMatchesScope(makeThread({ scopeKey: "pdf-2" }), scope)).toBe(
      true,
    );
    expect(
      threadMatchesScope(
        makeThread({
          scopeSnapshot: {
            type: "pdf",
            id: "pdf-2",
            label: "Legacy PDF",
            itemIds: [1],
            readerAttachmentId: 2,
          },
        }),
        scope,
      ),
    ).toBe(true);
    expect(threadMatchesScope(makeThread({ scopeKey: "pdf-3" }), scope)).toBe(
      false,
    );
  });

  it("lists only threads for the current scope newest first", async () => {
    const scope = makeScope();
    const oldestMatch = makeThread({
      id: "thread-old",
      scopeKey: "pdf-2",
      updatedAt: 10,
    });
    const newestMatch = makeThread({
      id: "thread-new",
      scopeKey: "pdf-2",
      updatedAt: 30,
    });
    const otherScope = makeThread({
      id: "thread-other",
      scopeKey: "pdf-3",
      updatedAt: 40,
    });
    vi.mocked(loadAllThreads).mockResolvedValue([
      oldestMatch,
      otherScope,
      newestMatch,
    ]);

    await expect(listThreadsForScope(scope)).resolves.toEqual([
      newestMatch,
      oldestMatch,
    ]);
  });

  it("finds the most recent thread for the current scope", async () => {
    const scope = makeScope();
    const older = makeThread({
      id: "thread-older",
      scopeKey: "pdf-2",
      updatedAt: 5,
    });
    const newer = makeThread({
      id: "thread-newer",
      scopeKey: "pdf-2",
      updatedAt: 6,
    });
    vi.mocked(loadAllThreads).mockResolvedValue([older, newer]);

    await expect(findMostRecentThreadForScope(scope)).resolves.toBe(newer);
  });
});
