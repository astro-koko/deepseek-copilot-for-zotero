# Deepseek Copliot Source Composer Tranche 1 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable Beaver-style composer core: visible current context, request-local source chips, a compact add-source menu, and DeepSeek model selection in the composer footer.

**Architecture:** Preserve `ScopeContext` as automatic Zotero surface state. Add a separate external `messageSourcesStore` for temporary evidence, pass a source snapshot through `chatSessionStore.send()` into `contextAssembler`, and clear it only when the provider accepts the request. Keep UI modules small: chip row, source menu, model selector, and composer orchestration.

**Tech Stack:** React 18, TypeScript, Vitest, Zotero host APIs, existing external-store pattern from `chatSessionStore`

---

## File Map

- Create: `src/types/messageSources.ts`
  - typed request-local source and filter references
- Create: `src/services/messageSources.ts`
  - pure source reducers plus subscribable store
- Create: `src/services/messageSources.test.ts`
  - add, deduplicate, remove, snapshot, clear, and restore tests
- Create: `src/services/messageSourcesContext.ts`
  - read Zotero items, notes, annotations, and collections into bounded context text
- Create: `src/services/messageSourcesContext.test.ts`
  - source-context formatting and stable-source dedup tests
- Create: `src/ui/components/sourceChipViewModel.ts`
  - stable and temporary chip labels with overflow rules
- Create: `src/ui/components/sourceChipViewModel.test.ts`
  - chip visibility, removability, and overflow tests
- Create: `src/ui/components/SourceChipRow.tsx`
  - compact source chips and `+` affordance
- Create: `src/ui/components/AddSourcesMenu.tsx`
  - current selection and in-session recent items
- Create: `src/ui/components/ModelSelectionButton.tsx`
  - `DeepSeek Flash` / `DeepSeek Pro` footer selector
- Modify: `src/services/contextAssembler.ts`
  - merge automatic context with temporary evidence
- Modify: `src/services/contextAssembler.test.ts`
  - merged context tests
- Modify: `src/services/chatEngine.ts`
  - pass temporary evidence into assembly
- Modify: `src/services/chatEngine.test.ts`
  - source forwarding test
- Modify: `src/services/chatSession.ts`
  - accept source snapshot and provider-accepted callback
- Modify: `src/services/chatSession.test.ts`
  - accepted-callback and pre-response failure tests
- Modify: `src/ui/components/Composer.tsx`
  - assemble the new three-region composer
- Modify: `src/ui/components/Sidebar.tsx`
  - wire source store and move model selector out of the header

### Task 1: Checkpoint The Existing Frontend Baseline

**Files:**
- Review: all currently modified files reported by `git status --short`
- Review: `docs/superpowers/specs/2026-06-01-ds-copilot-sidebar-host-tone-design.md`
- Review: `docs/superpowers/plans/2026-06-01-ds-copilot-sidebar-host-tone-plan.md`

- [ ] **Step 1: Confirm the current diff is mechanically clean**

Run:

```bash
git status --short --branch
git diff --check
```

Expected: the existing dirty files are visible and `git diff --check` prints no
errors.

- [ ] **Step 2: Run the existing regression suite**

Run:

```bash
npm test
npm run build
npm run verify:xpi
```

Expected: all commands pass before source-composer edits start. If they fail,
fix only the already-existing baseline issue and rerun.

- [ ] **Step 3: Commit the verified baseline**

Run:

```bash
git add src typings docs/superpowers/specs/2026-06-01-ds-copilot-sidebar-host-tone-design.md docs/superpowers/plans/2026-06-01-ds-copilot-sidebar-host-tone-plan.md
git commit -m "fix: checkpoint deepseek host frontend baseline"
git switch -c codex/beaver-source-composer
```

Expected: the new branch starts from a clean verified frontend baseline.

### Task 2: Add Typed Request-Local Source State

**Files:**
- Create: `src/types/messageSources.ts`
- Create: `src/services/messageSources.ts`
- Create: `src/services/messageSources.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/services/messageSources.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import {
  addCollectionSource,
  addItemSource,
  createEmptyMessageSources,
  createMessageSourcesStore,
  removeSource,
} from "./messageSources";

describe("messageSources", () => {
  it("deduplicates item sources by Zotero item id", () => {
    const initial = createEmptyMessageSources();
    const once = addItemSource(initial, {
      kind: "paper", itemId: 7, label: "Paper 7",
    });
    const twice = addItemSource(once, {
      kind: "paper", itemId: 7, label: "Paper 7",
    });
    expect(twice.items).toHaveLength(1);
  });

  it("removes only the selected temporary source", () => {
    const state = addCollectionSource(
      addItemSource(createEmptyMessageSources(), {
        kind: "note", itemId: 8, label: "Lab note",
      }),
      { collectionId: 3, label: "Evaluation", libraryId: 1 },
    );
    expect(removeSource(state, "item:8").items).toEqual([]);
    expect(removeSource(state, "item:8").collections).toHaveLength(1);
  });

  it("snapshots, clears, and restores the evidence basket", () => {
    const store = createMessageSourcesStore();
    store.addItem({ kind: "paper", itemId: 7, label: "Paper 7" });
    const snapshot = store.getSnapshot();
    store.clear();
    expect(store.getSnapshot().items).toEqual([]);
    store.restore(snapshot);
    expect(store.getSnapshot().items[0].label).toBe("Paper 7");
  });
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run:

```bash
npx vitest run src/services/messageSources.test.ts
```

Expected: FAIL because `messageSources.ts` does not exist.

- [ ] **Step 3: Add the types and minimal store**

Create `src/types/messageSources.ts`:

```ts
export type ItemSourceKind = "paper" | "pdf" | "note" | "annotation";

export interface ItemSourceReference {
  itemId: number;
  kind: ItemSourceKind;
  label: string;
}

export interface CollectionSourceReference {
  collectionId: number;
  label: string;
  libraryId: number;
}

export interface TagSourceReference {
  id: number;
  label: string;
  libraryId: number;
}

export interface MessageSources {
  collections: CollectionSourceReference[];
  filters: {
    collectionIds: number[];
    libraryIds: number[];
    tags: TagSourceReference[];
  };
  items: ItemSourceReference[];
}
```

Create `src/services/messageSources.ts` with:

```ts
import type {
  CollectionSourceReference,
  ItemSourceReference,
  MessageSources,
} from "../types/messageSources";

export const createEmptyMessageSources = (): MessageSources => ({
  collections: [],
  filters: { collectionIds: [], libraryIds: [], tags: [] },
  items: [],
});

export const cloneMessageSources = (state: MessageSources): MessageSources => ({
  collections: state.collections.map((source) => ({ ...source })),
  filters: {
    collectionIds: [...state.filters.collectionIds],
    libraryIds: [...state.filters.libraryIds],
    tags: state.filters.tags.map((tag) => ({ ...tag })),
  },
  items: state.items.map((source) => ({ ...source })),
});

export const sourceKey = (
  source: ItemSourceReference | CollectionSourceReference,
): string =>
  "itemId" in source
    ? `item:${source.itemId}`
    : `collection:${source.collectionId}`;

export const addItemSource = (
  state: MessageSources,
  source: ItemSourceReference,
): MessageSources =>
  state.items.some((item) => item.itemId === source.itemId)
    ? state
    : { ...state, items: [...state.items, source] };

export const addCollectionSource = (
  state: MessageSources,
  source: CollectionSourceReference,
): MessageSources =>
  state.collections.some((item) => item.collectionId === source.collectionId)
    ? state
    : { ...state, collections: [...state.collections, source] };

export const removeSource = (
  state: MessageSources,
  key: string,
): MessageSources => ({
  ...state,
  collections: state.collections.filter((source) => sourceKey(source) !== key),
  items: state.items.filter((source) => sourceKey(source) !== key),
});

export function createMessageSourcesStore() {
  const listeners = new Set<() => void>();
  let state = createEmptyMessageSources();
  let recentItems: ItemSourceReference[] = [];
  const emit = () => listeners.forEach((listener) => listener());
  const set = (next: MessageSources) => { state = next; emit(); };

  return {
    addCollection: (source: CollectionSourceReference) =>
      set(addCollectionSource(state, source)),
    addItem: (source: ItemSourceReference) => {
      recentItems = [
        source,
        ...recentItems.filter((item) => item.itemId !== source.itemId),
      ].slice(0, 5);
      set(addItemSource(state, source));
    },
    clear: () => set(createEmptyMessageSources()),
    getSnapshot: () => state,
    getRecentItems: () => recentItems,
    remove: (key: string) => set(removeSource(state, key)),
    restore: (snapshot: MessageSources) =>
      set(cloneMessageSources(snapshot)),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const messageSourcesStore = createMessageSourcesStore();
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npx vitest run src/services/messageSources.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit typed source state**

```bash
git add src/types/messageSources.ts src/services/messageSources.ts src/services/messageSources.test.ts
git commit -m "feat: add typed message source composition state"
```

### Task 3: Assemble Temporary Evidence With Automatic Scope

**Files:**
- Create: `src/services/messageSourcesContext.ts`
- Create: `src/services/messageSourcesContext.test.ts`
- Modify: `src/services/contextAssembler.ts`
- Modify: `src/services/contextAssembler.test.ts`

- [ ] **Step 1: Write failing source-context tests**

Create `src/services/messageSourcesContext.test.ts` covering:

```ts
it("formats notes and annotations beside the stable paper context", () => {
  const result = assembleMessageSourcesContext({
    ...createEmptyMessageSources(),
    items: [
      { kind: "note", itemId: 8, label: "Lab note" },
      { kind: "annotation", itemId: 9, label: "Highlighted result" },
    ],
  }, new Set([1]));
  expect(result.fullText).toContain("NOTE: Lab note");
  expect(result.fullText).toContain("ANNOTATION: Highlighted result");
});

it("skips a temporary paper already represented by stable context", () => {
  const result = assembleMessageSourcesContext({
    ...createEmptyMessageSources(),
    items: [{ kind: "paper", itemId: 1, label: "Current paper" }],
  }, new Set([1]));
  expect(result.metadata).toBe("");
});
```

Use fake Zotero items with `getNote()`, `annotationText`, `annotationComment`,
`getDisplayTitle()`, `getCreators()`, `getField()`, and `getAttachments()`.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/services/messageSourcesContext.test.ts
```

Expected: FAIL because `assembleMessageSourcesContext` does not exist.

- [ ] **Step 3: Add bounded source assembly**

Create `src/services/messageSourcesContext.ts` with this exported contract:

```ts
import type { MessageSources } from "../types/messageSources";

export interface MessageSourcesContext {
  fullText: string;
  metadata: string;
  warnings: string[];
}

export function assembleMessageSourcesContext(
  sources: MessageSources,
  stableItemIds: Set<number>,
): MessageSourcesContext
```

Implement these exact rules:

```ts
const SOURCE_CONTEXT_CHAR_LIMIT = 6000;

// item.kind === "note"
const noteText = String((item as any).getNote?.() || "").trim();
fullText.push(`\n=== NOTE: ${source.label} ===\n${noteText}`);

// item.kind === "annotation"
const annotationText = String((item as any).annotationText || "").trim();
const annotationComment = String((item as any).annotationComment || "").trim();
fullText.push(
  `\n=== ANNOTATION: ${source.label} ===\n${[annotationText, annotationComment].filter(Boolean).join("\\n")}`,
);

// collection source
const collection = Zotero.Collections.get(source.collectionId);
const childIds = collection?.getChildItems?.(true) || [];
metadata.push(`Collection: ${source.label} (${childIds.length} items)`);
```

For `paper` and `pdf`, keep the temporary-source module independent from
`contextAssembler.ts`: copy the three small private helpers
`extractAttachmentText()`, `formatItemMetadata()`, and
`resolveFirstPDFAttachment()` into `messageSourcesContext.ts`. Do not import
them from `contextAssembler.ts`, because `contextAssembler.ts` imports the new
module and a reverse import would create a cycle.

Skip missing items with a warning, skip item IDs found in `stableItemIds`, and
truncate joined temporary full text to `SOURCE_CONTEXT_CHAR_LIMIT`.

- [ ] **Step 4: Merge source context into automatic context**

Change the public assembler signature:

```ts
export function assembleContext(
  scope: ScopeContext,
  sources: MessageSources = createEmptyMessageSources(),
): AssembledContext
```

After the existing scope-specific assembly returns `automatic`, merge:

```ts
const temporary = assembleMessageSourcesContext(
  sources,
  new Set(scope.itemIds || []),
);
return {
  ...automatic,
  metadata: [automatic.metadata, temporary.metadata].filter(Boolean).join("\n\n"),
  fullText: [automatic.fullText, temporary.fullText].filter(Boolean).join("\n\n"),
  warnings: [...automatic.warnings, ...temporary.warnings],
};
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/services/messageSourcesContext.test.ts src/services/contextAssembler.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit source assembly**

```bash
git add src/services/messageSourcesContext.ts src/services/messageSourcesContext.test.ts src/services/contextAssembler.ts src/services/contextAssembler.test.ts
git commit -m "feat: merge temporary zotero sources into context"
```

### Task 4: Clear Sources Only After Provider Acceptance

**Files:**
- Modify: `src/services/chatEngine.ts`
- Modify: `src/services/chatEngine.test.ts`
- Modify: `src/services/chatSession.ts`
- Modify: `src/services/chatSession.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Add to `src/services/chatSession.test.ts`:

```ts
it("announces provider acceptance before consuming the response stream", async () => {
  const onAccepted = vi.fn();
  const stream = streamChunks("answer");
  // create store with the same thread fixtures as the first-message test
  await store.send("Question", scope, {
    messageSources: sources,
    onAccepted,
  });
  expect(onAccepted).toHaveBeenCalledTimes(1);
  expect(sendChatMessage).toHaveBeenCalledWith(
    threadWithUser,
    scope,
    sources,
    expect.any(AbortSignal),
  );
});

it("does not announce acceptance when dispatch fails before a response exists", async () => {
  const onAccepted = vi.fn();
  sendChatMessage.mockRejectedValue(new Error("network down"));
  await store.send("Question", scope, { messageSources: sources, onAccepted });
  expect(onAccepted).not.toHaveBeenCalled();
});
```

Add to `src/services/chatEngine.test.ts`:

```ts
it("forwards request-local sources to the context assembler", async () => {
  await sendChatMessage(makeThread([]), scope, sources);
  expect(providerMocks.assembleContext).toHaveBeenCalledWith(scope, sources);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/services/chatSession.test.ts src/services/chatEngine.test.ts
```

Expected: FAIL on the new signatures.

- [ ] **Step 3: Add the new send contracts**

In `src/services/chatSession.ts`, add:

```ts
import type { MessageSources } from "../types/messageSources";

export interface ChatSendOptions {
  messageSources?: MessageSources;
  onAccepted?: () => void;
}
```

Change `send()` to:

```ts
send(
  message: string,
  scope?: ScopeContext | null,
  options?: ChatSendOptions,
): Promise<void>;
```

Call the engine and acceptance callback in this order:

```ts
const response = await deps.sendChatMessage(
  thread,
  scope || undefined,
  options?.messageSources,
  abortController?.signal,
);
options?.onAccepted?.();
```

In `src/services/chatEngine.ts`, change:

```ts
export function buildMessages(
  thread: Thread,
  scope: ScopeContext | undefined,
  sources: MessageSources = createEmptyMessageSources(),
): ChatCompletionMessage[]
```

and:

```ts
export async function sendChatMessage(
  thread: Thread,
  scope: ScopeContext | undefined,
  sources: MessageSources = createEmptyMessageSources(),
  signal?: AbortSignal,
): Promise<StreamingResponse>
```

Pass `sources` into `assembleContext(scope, sources)`.

- [ ] **Step 4: Update existing signature expectations and run tests**

Update earlier `sendChatMessage` mock assertions to include `undefined` sources
before the signal.

Run:

```bash
npx vitest run src/services/chatSession.test.ts src/services/chatEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit accepted-send lifecycle**

```bash
git add src/services/chatSession.ts src/services/chatSession.test.ts src/services/chatEngine.ts src/services/chatEngine.test.ts
git commit -m "feat: clear composed sources after provider acceptance"
```

### Task 5: Build Source Chips And Footer Model Selector

**Files:**
- Create: `src/ui/components/sourceChipViewModel.ts`
- Create: `src/ui/components/sourceChipViewModel.test.ts`
- Create: `src/ui/components/SourceChipRow.tsx`
- Create: `src/ui/components/ModelSelectionButton.tsx`

- [ ] **Step 1: Write failing chip view-model tests**

Create `src/ui/components/sourceChipViewModel.test.ts`:

```ts
it("shows reader context as a non-removable Current File chip", () => {
  const model = buildSourceChipViewModel(pdfScope, createEmptyMessageSources());
  expect(model.chips[0]).toMatchObject({
    key: "stable:pdf-11", label: "Current File", removable: false,
  });
});

it("shows four temporary chips and one overflow chip", () => {
  const model = buildSourceChipViewModel(paperScope, fiveSources);
  expect(model.chips.filter((chip) => chip.removable)).toHaveLength(4);
  expect(model.overflowCount).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/ui/components/sourceChipViewModel.test.ts
```

Expected: FAIL because the view model does not exist.

- [ ] **Step 3: Add the chip view model**

Create `src/ui/components/sourceChipViewModel.ts` with:

```ts
const MAX_VISIBLE_TEMPORARY_CHIPS = 4;

export interface SourceChipModel {
  key: string;
  kind: string;
  label: string;
  removable: boolean;
}

export function buildSourceChipViewModel(
  scope: ScopeContext | null,
  sources: MessageSources,
): { chips: SourceChipModel[]; overflowCount: number }
```

Stable labels:

```ts
scope?.type === "pdf" ? "Current File" : "Current Paper"
scope?.selectedText ? "Selected Text" : null
```

Temporary chips map from `sources.items` and `sources.collections`, retain
their `sourceKey()`, and slice to `MAX_VISIBLE_TEMPORARY_CHIPS`.

- [ ] **Step 4: Add presentational components**

Create `SourceChipRow.tsx` with props:

```ts
interface SourceChipRowProps {
  onAddSource: () => void;
  onRemoveSource: (key: string) => void;
  scope: ScopeContext | null;
  sources: MessageSources;
}
```

Render the `+` button first, then chips, then a `+N` overflow chip.

Create `ModelSelectionButton.tsx` with props:

```ts
interface ModelSelectionButtonProps {
  model: string;
  onChange: (model: "deepseek-v4-flash" | "deepseek-v4-pro") => void;
}
```

Render one compact disclosure button and a two-item menu:

```tsx
<button type="button">Model: {label} ▾</button>
{open && (
  <div role="menu">
    <button role="menuitemradio" aria-checked={model === "deepseek-v4-flash"}>
      DeepSeek Flash
    </button>
    <button role="menuitemradio" aria-checked={model === "deepseek-v4-pro"}>
      DeepSeek Pro
    </button>
  </div>
)}
```

- [ ] **Step 5: Run focused tests**

```bash
npx vitest run src/ui/components/sourceChipViewModel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit visual primitives**

```bash
git add src/ui/components/sourceChipViewModel.ts src/ui/components/sourceChipViewModel.test.ts src/ui/components/SourceChipRow.tsx src/ui/components/ModelSelectionButton.tsx
git commit -m "feat: add source chips and footer model selector"
```

### Task 6: Add The Core Source Menu And Composer Shell

**Files:**
- Create: `src/ui/components/AddSourcesMenu.tsx`
- Modify: `src/ui/components/Composer.tsx`
- Modify: `src/ui/components/Sidebar.tsx`

- [ ] **Step 1: Add the core source menu**

Create `AddSourcesMenu.tsx` with props:

```ts
interface AddSourcesMenuProps {
  onAddCollection: (collection: CollectionSourceReference) => void;
  onAddItem: (source: ItemSourceReference) => void;
  onClose: () => void;
}
```

On open, collect the current Zotero selection:

```ts
const selectedItems =
  (Zotero.getMainWindow() as any)?.ZoteroPane?.getSelectedItems?.() || [];
```

Map supported items with:

```ts
function itemToSource(item: Zotero.Item): ItemSourceReference | null {
  if (item.isRegularItem?.()) return { kind: "paper", itemId: item.id, label: item.getDisplayTitle() };
  if (item.isPDFAttachment?.()) return { kind: "pdf", itemId: item.id, label: item.getDisplayTitle() };
  if (item.isNote?.()) return { kind: "note", itemId: item.id, label: item.getNoteTitle?.() || "Note" };
  if (item.isAnnotation?.()) return { kind: "annotation", itemId: item.id, label: item.annotationText || "Annotation" };
  return null;
}
```

Show `Current selection` and store-backed `Recent sources` sections. Selecting
an item calls `onAddItem()` and closes the menu.

For a currently selected collection, read:

```ts
const collectionsView =
  (Zotero.getMainWindow() as any)?.ZoteroPane?.collectionsView;
const row = collectionsView?.getRow?.(collectionsView.selection?.currentIndex);
const collection = row?.isCollection?.() ? row.ref : null;
```

When present, render one `Current collection` row that calls:

```ts
onAddCollection({
  collectionId: collection.id,
  label: collection.name,
  libraryId: collection.libraryID,
});
```

- [ ] **Step 2: Convert Composer to the three-region layout**

Update `ComposerProps`:

```ts
interface ComposerProps {
  currentScopeType: ScopeType | null;
  disabled?: boolean;
  disabledReason?: string | null;
  draftValue?: string;
  focusNonce?: number;
  isStreaming: boolean;
  model: string;
  onCancel?: () => void;
  onDraftChange?: (value: string) => void;
  onModelChange: (model: "deepseek-v4-flash" | "deepseek-v4-pro") => void;
  onSend: (message: string, onAccepted: () => void) => void;
  scope: ScopeContext | null;
  sources: MessageSources;
}
```

Render in this order:

```tsx
<SourceChipRow ... />
{showSources && <AddSourcesMenu ... />}
<textarea rows={1} ... />
<div style={styles.footerRow}>
  <ModelSelectionButton model={model} onChange={onModelChange} />
  <div style={{ flex: 1 }} />
  {isStreaming ? <button>Stop</button> : <button>Send ↵</button>}
</div>
```

In `handleSubmit`, do not clear immediately. Pass an acceptance callback:

```ts
onSend(trimmed, () => {
  setInput("");
  onDraftChange?.("");
  setShowPresets(false);
});
```

Auto-grow the textarea in `onInput` and use the concise Beaver-style
placeholder supplied by the sidebar view model.

- [ ] **Step 3: Wire Sidebar and remove the header model toggle**

In `Sidebar.tsx` subscribe to sources:

```ts
const messageSources = useSyncExternalStore(
  messageSourcesStore.subscribe,
  messageSourcesStore.getSnapshot,
);
```

Change the send handler:

```ts
const handleSend = (
  userInput: string,
  onAccepted: () => void = () => {},
) => {
  if (!isSupportedChatScope(scope)) return;
  const snapshot = messageSourcesStore.getSnapshot();
  void chatSessionStore.send(userInput, scope, {
    messageSources: snapshot,
    onAccepted: () => {
      messageSourcesStore.clear();
      onAccepted();
    },
  });
};
```

Pass `scope`, `sources`, `settings.model`, `handleModelChange`, and the new
`handleSend` into `Composer`. Remove the header `Light` / `Deep` toggle.

- [ ] **Step 4: Update placeholder copy**

In `sidebarViewModel.ts`, change supported-scope placeholders:

```ts
return scope.type === "pdf"
  ? "@ to add a source, / for actions, drag to add annotations"
  : "@ to add a source, / for actions";
```

Update `sidebarViewModel.test.ts` expectations.

- [ ] **Step 5: Run focused regression tests**

```bash
npx vitest run src/services/messageSources.test.ts src/services/messageSourcesContext.test.ts src/services/contextAssembler.test.ts src/services/chatSession.test.ts src/services/chatEngine.test.ts src/ui/components/sourceChipViewModel.test.ts src/ui/components/sidebarViewModel.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit the core shell**

```bash
git add src/ui/components/AddSourcesMenu.tsx src/ui/components/Composer.tsx src/ui/components/Sidebar.tsx src/ui/components/sidebarViewModel.ts src/ui/components/sidebarViewModel.test.ts
git commit -m "feat: add researcher source composer shell"
```

### Task 7: Verify Tranche 1 In Zotero

**Files:**
- Update: `docs/zotero-dev-smoke-checklist.md`

- [ ] **Step 1: Run the full logic loop**

```bash
npm test
npm run build
npm run verify:xpi
```

Expected: PASS.

- [ ] **Step 2: Run a daily-profile host smoke**

Use the existing Zotero daily profile. Record PASS/FAIL for:

```text
Library paper selected -> Current Paper chip visible
Reader PDF opened -> Current File chip visible
+ menu -> selected paper can be added
temporary paper chip -> removable
footer model selector -> Flash and Pro persist
successful send -> temporary chip clears, Current File remains
failed pre-response send -> draft and temporary chip remain
```

- [ ] **Step 3: Record evidence and commit**

Append the dated results to `docs/zotero-dev-smoke-checklist.md`, then:

```bash
git add docs/zotero-dev-smoke-checklist.md
git commit -m "test: verify core source composer host flow"
```
