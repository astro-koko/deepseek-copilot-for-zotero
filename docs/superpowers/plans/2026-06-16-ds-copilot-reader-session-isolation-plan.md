# Deepseek Copliot Reader Session Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Reader sidebars visible instead of blank and keep Deepseek Copliot conversations isolated per active paper/PDF.

**Architecture:** Reuse the existing one-host-per-window Reader/Library sidebar architecture. Add stable document scope keys to scope and thread models, use those keys to select recent/active threads, and stop automatic cross-document thread rewriting. Keep Zotero right-side pane ownership unchanged.

**Tech Stack:** TypeScript, React, Vitest, Zotero.DB, Zotero Reader APIs, Zotero Item Pane Manager.

---

## File Map

Create:

- `docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md` - design spec for host stability and document-scoped conversations.
- `docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md` - this execution plan.
- `src/services/threadController.test.ts` - focused thread scope-key list tests.

Modify:

- `docs/zotero-doc-index.md` - link the new spec and plan.
- `src/types/scope.ts` - add optional `scopeKey`.
- `src/types/thread.ts` - add optional `scopeKey`.
- `src/services/scopeResolver.ts` - populate stable scope keys for paper/PDF/library selections and Reader tab data.
- `src/services/persistence.ts` - persist and load `scopeKey`, including legacy derivation.
- `src/services/threadController.ts` - create/list/find threads by scope key.
- `src/services/chatSession.ts` - isolate active thread by scope key instead of mutating scope.
- `src/ui/sidebarSection.ts` - add surface matching helper for reader-like tab types.
- `src/ui/components/Sidebar.tsx` - use surface matching helper, scope-filter recent threads, and render an error fallback.
- Existing focused tests beside modified modules.

Out of scope:

- Provider request changes.
- Settings changes.
- Release-version changes.
- Real GUI smoke automation in this implementation pass.

## Task 1: Spec And Plan Baseline

**Files:**

- Create: `docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md`
- Create: `docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md`
- Modify: `docs/zotero-doc-index.md`

- [ ] **Step 1: Add the spec and plan files**

Use the spec file to record classification, affected surfaces, privacy boundary, files expected to change, acceptance criteria, verification, real Zotero smoke, and reference adoption.

- [ ] **Step 2: Link the new files from the doc index**

Add these two links under `Current execution docs` in `docs/zotero-doc-index.md`:

```md
- [docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/specs/2026-06-16-ds-copilot-reader-session-isolation-design.md)
- [docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md](/Users/liang/Project/agentpaper_zotero/docs/superpowers/plans/2026-06-16-ds-copilot-reader-session-isolation-plan.md)
```

- [ ] **Step 3: Run documentation sanity check**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

## Task 2: Reader Surface Matching And Visible Sidebar Fallback

**Files:**

- Modify: `src/ui/sidebarSection.ts`
- Modify: `src/ui/sidebarSection.test.ts`
- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/components/SidebarSource.test.ts`

- [ ] **Step 1: Write failing tests for Reader-like tab matching**

Add this test to `src/ui/sidebarSection.test.ts`:

```ts
it("matches reader-like tab types to the reader sidebar location", () => {
  expect(isSidebarLocationSelected("reader", "reader")).toBe(true);
  expect(isSidebarLocationSelected("reader-preview", "reader")).toBe(true);
  expect(isSidebarLocationSelected("reader-loading", "reader")).toBe(true);
  expect(isSidebarLocationSelected("library", "reader")).toBe(false);
  expect(isSidebarLocationSelected("collection", "library")).toBe(true);
});
```

Also add `isSidebarLocationSelected` to the import list.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm test -- src/ui/sidebarSection.test.ts
```

Expected: fail because `isSidebarLocationSelected` is not exported.

- [ ] **Step 3: Implement the helper**

Add this export to `src/ui/sidebarSection.ts` after `resolveSidebarLocation`:

```ts
export function isSidebarLocationSelected(
  tabType: string,
  location: SidebarLocation,
): boolean {
  return resolveSidebarLocation(tabType) === location;
}
```

- [ ] **Step 4: Replace strict Reader surface comparison**

In `src/ui/components/Sidebar.tsx`, import `isSidebarLocationSelected` from `../sidebarSection` and replace:

```ts
if (selectedType !== location) {
```

with:

```ts
if (!isSidebarLocationSelected(`${selectedType || ""}`, location)) {
```

- [ ] **Step 5: Write failing source test for visible error fallback**

Add this test to `src/ui/components/SidebarSource.test.ts`:

```ts
it("wraps sidebar rendering in an error boundary so React failures are visible", () => {
  expect(sidebarSource).toContain("class SidebarErrorBoundary");
  expect(sidebarSource).toContain("componentDidCatch");
  expect(sidebarSource).toContain("Deepseek Copliot sidebar unavailable");
  expect(sidebarSource).toContain("<SidebarErrorBoundary>");
});
```

- [ ] **Step 6: Run the source test and confirm it fails**

Run:

```bash
npm test -- src/ui/components/SidebarSource.test.ts
```

Expected: fail because the error boundary is missing.

- [ ] **Step 7: Add the minimal error boundary**

In `src/ui/components/Sidebar.tsx`, wrap the returned container in:

```tsx
return (
  <SidebarErrorBoundary>
    <div ...>
      ...
    </div>
  </SidebarErrorBoundary>
);
```

Add this class before helper functions:

```tsx
class SidebarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { message: string | null }
> {
  state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message:
        error instanceof Error && error.message
          ? error.message
          : "Unknown sidebar render failure",
    };
  }

  componentDidCatch(error: unknown) {
    debugLog.error("sidebar.render.error", error, {
      surface: "sidebar",
    });
  }

  render() {
    if (this.state.message) {
      return (
        <div style={styles.errorBoundary}>
          <div style={styles.errorBoundaryTitle}>
            Deepseek Copliot sidebar unavailable
          </div>
          <div style={styles.errorBoundaryMessage}>{this.state.message}</div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Add `errorBoundary`, `errorBoundaryTitle`, and `errorBoundaryMessage` entries to `styles`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/ui/sidebarSection.test.ts src/ui/components/SidebarSource.test.ts
```

Expected: pass.

## Task 3: Stable Scope Keys And Persistence

**Files:**

- Modify: `src/types/scope.ts`
- Modify: `src/types/thread.ts`
- Modify: `src/services/scopeResolver.ts`
- Modify: `src/services/scopeResolver.test.ts`
- Modify: `src/services/persistence.ts`
- Modify: `src/services/persistence.test.ts`

- [ ] **Step 1: Write failing scope-key tests**

In `src/services/scopeResolver.test.ts`, update existing expected paper/PDF scopes to include:

```ts
scopeKey: "paper-44"
```

for paper scopes and:

```ts
scopeKey: "pdf-22"
```

for PDF scopes. Use the item id already present in each test.

- [ ] **Step 2: Run scope resolver test and confirm it fails**

Run:

```bash
npm test -- src/services/scopeResolver.test.ts
```

Expected: fail because `scopeKey` is not included in resolved scopes.

- [ ] **Step 3: Add type fields and scope-key helper**

Add `scopeKey?: string` to `ScopeContext` and `Thread`.

In `src/services/scopeResolver.ts`, add:

```ts
function buildDocumentScopeKey(type: "paper" | "pdf", itemId: number): string {
  return `${type}-${itemId}`;
}
```

Populate `scopeKey` wherever `paper` or `pdf` scopes are returned.

- [ ] **Step 4: Run scope resolver test**

Run:

```bash
npm test -- src/services/scopeResolver.test.ts
```

Expected: pass.

- [ ] **Step 5: Write failing persistence tests**

In `src/services/persistence.test.ts`, update the `persists and reloads threads` test thread with `scopeKey: "paper-1"` and expect the insert call to include it. Add this test:

```ts
it("derives scopeKey for legacy threads that only have a scope snapshot", async () => {
  const scopeSnapshot = {
    type: "pdf",
    id: "pdf-99",
    label: "Legacy PDF",
    itemIds: [98],
    readerAttachmentId: 99,
  };

  queryAsync
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce([
      {
        id: "thread-legacy-scope",
        title: "Legacy",
        createdAt: 1,
        updatedAt: 2,
        scopeKey: null,
        scopeSnapshot: JSON.stringify(scopeSnapshot),
        messages: "[]",
      },
    ])
    .mockResolvedValueOnce(undefined);

  await expect(loadThread("thread-legacy-scope")).resolves.toMatchObject({
    id: "thread-legacy-scope",
    scopeKey: "pdf-99",
    scopeSnapshot,
  });
});
```

- [ ] **Step 6: Run persistence test and confirm it fails**

Run:

```bash
npm test -- src/services/persistence.test.ts
```

Expected: fail because schema/load/save do not include `scopeKey`.

- [ ] **Step 7: Implement persistence support**

Update schema:

```sql
scopeKey TEXT,
```

Update insert:

```sql
INSERT OR REPLACE INTO threads (id, title, createdAt, updatedAt, scopeKey, scopeSnapshot, messages)
VALUES (?, ?, ?, ?, ?, ?, ?)
```

Update row conversion to set `scopeKey: row.scopeKey || deriveThreadScopeKey(scopeSnapshot)`.

Add:

```ts
function deriveThreadScopeKey(scopeSnapshot: Thread["scopeSnapshot"]): string | undefined {
  if (!scopeSnapshot) return undefined;
  if (scopeSnapshot.scopeKey) return scopeSnapshot.scopeKey;
  if (scopeSnapshot.type === "pdf" && scopeSnapshot.readerAttachmentId) {
    return `pdf-${scopeSnapshot.readerAttachmentId}`;
  }
  if (scopeSnapshot.type === "paper" && scopeSnapshot.itemIds.length === 1) {
    return `paper-${scopeSnapshot.itemIds[0]}`;
  }
  return scopeSnapshot.id;
}
```

- [ ] **Step 8: Run persistence tests**

Run:

```bash
npm test -- src/services/persistence.test.ts src/services/scopeResolver.test.ts
```

Expected: pass.

## Task 4: Thread Controller And Chat Session Isolation

**Files:**

- Create: `src/services/threadController.test.ts`
- Modify: `src/services/threadController.ts`
- Modify: `src/services/chatSession.ts`
- Modify: `src/services/chatSession.test.ts`

- [ ] **Step 1: Add failing thread controller tests**

Create `src/services/threadController.test.ts` with tests that mock persistence and verify:

```ts
listThreadsForScope({ scopeKey: "pdf-2" }) returns only pdf-2 threads newest first
findMostRecentThreadForScope({ scopeKey: "pdf-2" }) returns the newest matching thread
```

- [ ] **Step 2: Run thread controller tests and confirm they fail**

Run:

```bash
npm test -- src/services/threadController.test.ts
```

Expected: fail because the exported functions do not exist.

- [ ] **Step 3: Implement thread scope helpers**

In `src/services/threadController.ts`, export:

```ts
export function getScopeKey(scope?: ScopeContext | null): string | undefined {
  if (!scope) return undefined;
  return scope.scopeKey || scope.id;
}

export function threadMatchesScope(thread: Thread, scope?: ScopeContext | null): boolean {
  const scopeKey = getScopeKey(scope);
  if (!scopeKey) return false;
  return (thread.scopeKey || thread.scopeSnapshot?.scopeKey || thread.scopeSnapshot?.id) === scopeKey;
}

export async function listThreadsForScope(scope: ScopeContext, limit = 5): Promise<Thread[]> {
  const threads = await listThreads();
  return threads.filter((thread) => threadMatchesScope(thread, scope)).slice(0, limit);
}

export async function findMostRecentThreadForScope(scope: ScopeContext): Promise<Thread | null> {
  return (await listThreadsForScope(scope, 1))[0] ?? null;
}
```

Update `createThread` so new threads include `scopeKey: getScopeKey(scope)`.

- [ ] **Step 4: Run thread controller tests**

Run:

```bash
npm test -- src/services/threadController.test.ts
```

Expected: pass.

- [ ] **Step 5: Write failing chat-session isolation tests**

In `src/services/chatSession.test.ts`, replace the test named `keeps one active thread while the scope changes between surfaces` with a test expecting `syncScope(nextScope)` to clear or keep inactive a cross-scope thread without calling `recordScopeTransition`.

Add a send test where an active PDF A thread exists, `send()` is called with PDF B scope, and `createThread(pdfB)` is called instead of appending to PDF A.

- [ ] **Step 6: Run chat session tests and confirm they fail**

Run:

```bash
npm test -- src/services/chatSession.test.ts
```

Expected: fail because current behavior mutates the active thread scope.

- [ ] **Step 7: Implement minimal chat-session isolation**

In `src/services/chatSession.ts`, replace automatic scope transition with scope matching:

```ts
function getScopeKey(scope?: ScopeContext | null): string | undefined {
  return scope?.scopeKey || scope?.id;
}

function getThreadScopeKey(thread: Thread): string | undefined {
  return thread.scopeKey || thread.scopeSnapshot?.scopeKey || thread.scopeSnapshot?.id;
}

function isThreadInScope(thread: Thread, scope?: ScopeContext | null): boolean {
  const scopeKey = getScopeKey(scope);
  if (!scopeKey) return true;
  return getThreadScopeKey(thread) === scopeKey;
}
```

Change `send()` so it creates a new thread when `state.activeThread` exists but `!isThreadInScope(state.activeThread, scope)`.

Change `syncScope()` so it clears `activeThread` when the active thread is from another scope.

- [ ] **Step 8: Run chat-session tests**

Run:

```bash
npm test -- src/services/chatSession.test.ts src/services/threadController.test.ts
```

Expected: pass.

## Task 5: Sidebar Current-Scope Recent Threads

**Files:**

- Modify: `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/components/SidebarSource.test.ts`
- Modify: `src/ui/components/sidebarViewModel.test.ts` if the view model needs wording updates.

- [ ] **Step 1: Write failing source test**

Add this to `src/ui/components/SidebarSource.test.ts`:

```ts
it("loads recent chats through the current scope before falling back to global history", () => {
  expect(sidebarSource).toContain("listThreadsForScope");
  expect(sidebarSource).toContain("findMostRecentThreadForScope");
  expect(sidebarSource).toContain("scope?.scopeKey");
});
```

- [ ] **Step 2: Run source test and confirm it fails**

Run:

```bash
npm test -- src/ui/components/SidebarSource.test.ts
```

Expected: fail because Sidebar only imports `listThreads`.

- [ ] **Step 3: Implement scoped recent loading**

In `Sidebar.tsx`, import `listThreadsForScope` and `findMostRecentThreadForScope`.

Update the recent-loading effect so when `scope` is supported it loads `listThreadsForScope(scope)` first, and falls back to `listThreads()` only when no scoped threads exist.

In `syncScope`, after setting scope, if the current active thread belongs to a different scope, call `findMostRecentThreadForScope(nextScope)` and open it if present.

- [ ] **Step 4: Run focused sidebar tests**

Run:

```bash
npm test -- src/ui/components/SidebarSource.test.ts src/ui/components/sidebarViewModel.test.ts
```

Expected: pass.

## Task 6: Focused Gate And Dev XPI Build

**Files:**

- No new production files.

- [ ] **Step 1: Run focused regression set**

Run:

```bash
npm test -- src/ui/sidebarSection.test.ts src/ui/components/SidebarSource.test.ts src/services/scopeResolver.test.ts src/services/persistence.test.ts src/services/threadController.test.ts src/services/chatSession.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: pass.

- [ ] **Step 3: Build dev XPI**

Run:

```bash
npm run build:dev:xpi
```

Expected: dev XPI build completes and produces a packaged artifact.

- [ ] **Step 4: Record remaining real Zotero smoke**

Update final report with the manual smoke items:

- install dev XPI through Add-ons
- confirm Reader right-pane body visible across three PDF tabs
- confirm PDF A/B histories stay separate
- trigger `Explain` and `Ask...`
- restart Zotero and repeat the Reader host and two-tab checks

## Self-Review

Spec coverage:

- Reader blank body: Task 2.
- Reader-like tab handoff: Task 2.
- stable document identity: Task 3.
- persistence and legacy derivation: Task 3.
- isolated active sessions: Task 4.
- scoped recent history: Task 5.
- test/build gates and real smoke evidence: Task 6.

Placeholder scan:

- No `TBD`, generic `TODO`, or unspecified test commands remain.

Type consistency:

- `scopeKey` is optional on `ScopeContext` and `Thread`.
- `listThreadsForScope`, `findMostRecentThreadForScope`, and `threadMatchesScope` use the same `scopeKey` shape.
